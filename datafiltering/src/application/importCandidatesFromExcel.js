import { createCandidate } from '../domain/candidate.js';
import { computeCandidateDedupeKey } from '../domain/dedupe.js';
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeSkills
} from '../domain/normalize.js';

export class ImportCandidatesFromExcel {
  constructor({ excelReader, schemaMapperFactory, candidateRepository, logger }) {
    this.excelReader = excelReader;
    this.schemaMapperFactory = schemaMapperFactory;
    this.candidateRepository = candidateRepository;
    this.logger = logger;
  }

  async execute({ filePath, sheetName, batchSize = 1000, ensureIndexes = true }) {
    if (ensureIndexes) {
      await this.candidateRepository.ensureIndexes();
    }

    const stream = this.excelReader.open(filePath, { sheetName });

    let mapper = null;
    let processedRows = 0;
    let persisted = 0;
    let buffer = [];

    const flush = async () => {
      if (!buffer.length) return;
      const res = await this.candidateRepository.upsertMany(buffer);
      persisted += (res.upserted || 0) + (res.modified || 0);
      buffer = [];
    };

    for await (const item of stream) {
      if (item.kind === 'header') {
        mapper = this.schemaMapperFactory.createForHeader(item.header);
        if (this.logger) {
          this.logger.info(
            { filePath, sheetName: item.sheetName },
            'excel header detected'
          );
        }
        continue;
      }

      if (item.kind !== 'row' || !mapper) continue;

      const mapped = mapper.mapRow(item.record);

      const firstName = mapped.firstName ? normalizeName(mapped.firstName) : null;
      const lastName = mapped.lastName ? normalizeName(mapped.lastName) : null;

      let fullName = normalizeName(mapped.fullName);
      if (!fullName && (firstName || lastName)) {
        fullName = normalizeName([firstName, lastName].filter(Boolean).join(' '));
      }

      // If we have only fullName, optionally split into first/last for search UX
      let derivedFirstName = firstName;
      let derivedLastName = lastName;
      if (fullName && !derivedFirstName && !derivedLastName) {
        const parts = String(fullName).split(' ').filter(Boolean);
        if (parts.length === 1) {
          derivedFirstName = parts[0];
        } else if (parts.length > 1) {
          derivedFirstName = parts[0];
          derivedLastName = parts.slice(1).join(' ');
        }
      }

      const email = normalizeEmail(mapped.email);
      const phone = normalizePhone(mapped.phone);
      const skills = normalizeSkills(mapped.skills);

      const designation = mapped.designation
        ? String(mapped.designation).trim()
        : mapped.currentTitle
          ? String(mapped.currentTitle).trim()
          : null;
      const currentCompany = mapped.currentCompany
        ? String(mapped.currentCompany).trim()
        : null;

      const description = mapped.description ? String(mapped.description).trim() : null;
      const experienceText = mapped.experienceText ? String(mapped.experienceText).trim() : null;
      const specialization = mapped.specialization ? String(mapped.specialization).trim() : null;
      const qualification = mapped.qualification ? String(mapped.qualification).trim() : null;
      const stream = mapped.stream ? String(mapped.stream).trim() : null;
      const proficiency = mapped.proficiency ? String(mapped.proficiency).trim() : null;
      const preferredLocation = mapped.preferredLocation ? String(mapped.preferredLocation).trim() : null;

      const dedupeKey = computeCandidateDedupeKey({
        email,
        phone,
        fullName
      });

      if (!dedupeKey) continue;

      const candidate = createCandidate({
        dedupeKey,
        fullName,
        firstName: derivedFirstName,
        lastName: derivedLastName,
        description,
        emails: email ? [email] : [],
        phones: phone ? [phone] : [],
        skills,
        location: mapped.location ? String(mapped.location).trim() : null,
        preferredLocation,
        designation,
        currentCompany,
        experienceYears:
          mapped.experienceYears == null || mapped.experienceYears === ''
            ? null
            : Number(mapped.experienceYears),
        experienceText,
        specialization,
        qualification,
        stream,
        proficiency,
        raw: mapped.raw,
        sources: [
          {
            filePath,
            sheetName: item.sheetName,
            rowNumber: item.rowNumber
          }
        ]
      });

      buffer.push(candidate);
      processedRows += 1;

      if (buffer.length >= batchSize) {
        await flush();
      }
    }

    await flush();

    if (this.logger) {
      this.logger.info(
        { filePath, processedRows, persisted },
        'import candidates completed'
      );
    }

    return { filePath, processedRows, persisted };
  }
}
