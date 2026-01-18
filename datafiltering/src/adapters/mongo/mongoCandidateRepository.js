import { CandidateRepository } from '../../ports/candidateRepository.js';

export class MongoCandidateRepository extends CandidateRepository {
  constructor({ db, collectionName, logger }) {
    super();
    this.db = db;
    this.collectionName = collectionName;
    this.collection = db.collection(collectionName);
    this.logger = logger;
  }

  buildUpsertUpdate(candidate) {
    return {
      $set: {
        dedupeKey: candidate.dedupeKey,
        profile: candidate.profile,
        contacts: candidate.contacts,
        professional: candidate.professional,
        meta: candidate.meta,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      },
      $addToSet: {
        sources: { $each: candidate.sources || [] }
      }
    };
  }

  pickCandidateFilter(candidate) {
    const email = candidate?.contacts?.emails?.[0];
    if (email) return { 'contacts.emails': email };

    const phone = candidate?.contacts?.phones?.[0];
    if (phone) return { 'contacts.phones': phone };

    return { dedupeKey: candidate.dedupeKey };
  }

  async ensureCollection() {
    const candidatesValidator = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['dedupeKey', 'profile', 'contacts', 'professional', 'createdAt', 'updatedAt'],
        additionalProperties: true,
        properties: {
          dedupeKey: { bsonType: 'string' },
          profile: {
            bsonType: 'object',
            additionalProperties: true,
            properties: {
              fullName: { bsonType: ['string', 'null'] }
            }
          },
          contacts: {
            bsonType: 'object',
            additionalProperties: true,
            properties: {
              emails: { bsonType: 'array', items: { bsonType: 'string' } },
              phones: { bsonType: 'array', items: { bsonType: 'string' } }
            }
          },
          professional: {
            bsonType: 'object',
            additionalProperties: true,
            properties: {
              designation: { bsonType: ['string', 'null'] },
              currentCompany: { bsonType: ['string', 'null'] },
              experienceYears: { bsonType: ['number', 'null'] },
              skills: { bsonType: 'array', items: { bsonType: 'string' } },
              location: { bsonType: ['string', 'null'] }
            }
          },
          sources: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              additionalProperties: true,
              properties: {
                filePath: { bsonType: 'string' },
                sheetName: { bsonType: 'string' },
                rowNumber: { bsonType: 'number' }
              }
            }
          },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' }
        }
      }
    };

    const existing = await this.db
      .listCollections({ name: this.collectionName }, { nameOnly: true })
      .toArray();

    if (!existing.length) {
      await this.db.createCollection(this.collectionName, {
        validator: candidatesValidator,
        validationLevel: 'moderate'
      });
      this.collection = this.db.collection(this.collectionName);
      return;
    }

    await this.db.command({
      collMod: this.collectionName,
      validator: candidatesValidator,
      validationLevel: 'moderate'
    });
  }

  async ensureIndexes() {
    await this.ensureCollection();
    await this.collection.createIndex(
      { dedupeKey: 1 },
      {
        unique: true,
        partialFilterExpression: { dedupeKey: { $type: 'string' } }
      }
    );

    // Enforce dedupe at DB level for primary identifiers.
    // Unique multikey indexes ensure no email/phone value appears across multiple candidates.
    await this.collection.createIndex(
      { 'contacts.emails': 1 },
      {
        unique: true,
        partialFilterExpression: {
          'contacts.emails.0': { $exists: true }
        }
      }
    );

    await this.collection.createIndex(
      { 'contacts.phones': 1 },
      {
        unique: true,
        partialFilterExpression: {
          'contacts.phones.0': { $exists: true }
        }
      }
    );

    // Useful secondary indexes for search/filter.
    await this.collection.createIndex({ 'professional.skills': 1 });
    await this.collection.createIndex({ 'professional.location': 1 });
    await this.collection.createIndex({ 'professional.preferredLocation': 1 });
    await this.collection.createIndex({ 'professional.designation': 1 });
    await this.collection.createIndex({ 'professional.currentCompany': 1 });
    await this.collection.createIndex({ 'professional.specialization': 1 });
    await this.collection.createIndex({ 'professional.experienceYears': 1 });
    await this.collection.createIndex({ 'professional.stream': 1 });
    await this.collection.createIndex({ 'professional.proficiency': 1 });
    await this.collection.createIndex({ updatedAt: -1 });
  }

  async upsertOne(candidate) {
    if (!candidate || !candidate.dedupeKey) {
      throw new Error('candidate.dedupeKey is required');
    }

    const filter = this.pickCandidateFilter(candidate);
    const update = this.buildUpsertUpdate(candidate);

    try {
      const res = await this.collection.findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: 'after'
      });
      return res.value;
    } catch (e) {
      // Race condition: two upserts at same time can hit unique constraint.
      if (e?.code !== 11000) throw e;

      const email = candidate?.contacts?.emails?.[0];
      if (email) {
        const doc = await this.collection.findOne({ 'contacts.emails': email });
        if (doc) return doc;
      }

      const phone = candidate?.contacts?.phones?.[0];
      if (phone) {
        const doc = await this.collection.findOne({ 'contacts.phones': phone });
        if (doc) return doc;
      }

      const doc = await this.collection.findOne({ dedupeKey: candidate.dedupeKey });
      if (doc) return doc;

      throw e;
    }
  }

  async upsertMany(candidates) {
    if (!candidates.length) return { upserted: 0, modified: 0 };

    const ops = [];
    for (const c of candidates) {
      if (!c.dedupeKey) continue;

      ops.push({
        updateOne: {
          filter: this.pickCandidateFilter(c),
          update: this.buildUpsertUpdate(c),
          upsert: true
        }
      });
    }

    if (!ops.length) return { upserted: 0, modified: 0 };

    let res;
    try {
      res = await this.collection.bulkWrite(ops, { ordered: false });
    } catch (e) {
      if (e?.code !== 11000) throw e;
      res = e?.result;
    }

    const upserted = res?.upsertedCount || 0;
    const modified = res?.modifiedCount || 0;

    if (this.logger) {
      this.logger.info(
        { upserted, modified, matched: res?.matchedCount || 0 },
        'mongo bulk upsert completed'
      );
    }

    return { upserted, modified };
  }
}
