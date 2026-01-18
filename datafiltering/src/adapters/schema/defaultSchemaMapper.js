import { SchemaMapperFactory } from '../../ports/schemaMapper.js';

function normalizeHeaderKey(s) {
  const raw = String(s || '')
    .trim()
    .toLowerCase();

  // Normalize punctuation into spaces so "curr. company" matches "curr company"
  // and "preferred locations" matches "preferred location" more reliably.
  const noPunct = raw.replace(/[^a-z0-9]+/g, ' ');

  // Expand common recruitment abbreviations
  const expanded = noPunct
    .replace(/\bcurr\b/g, 'current')
    .replace(/\bexp\b/g, 'experience')
    .replace(/\byrs\b/g, 'years')
    .replace(/\byr\b/g, 'year')
    .replace(/\bdept\b/g, 'department')
    .replace(/\bloc\b/g, 'location');

  return expanded.replace(/\s+/g, ' ').trim();
}

export class DefaultSchemaMapperFactory extends SchemaMapperFactory {
  createForHeader(headerRow) {
    const header = headerRow.map(normalizeHeaderKey);

    const find = (...candidates) => {
      for (const c of candidates) {
        const idx = header.indexOf(normalizeHeaderKey(c));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const idx = {
      firstName: find('first name', 'firstname', 'given name', 'candidate first name'),
      lastName: find('last name', 'lastname', 'surname', 'family name', 'candidate last name'),
      fullName: find(
        'name',
        'full name',
        'candidate name',
        'doctor name',
        'nurse name',
        'employee name',
        'resource name'
      ),
      email: find('email', 'email id', 'e-mail', 'mail', 'mail id', 'email address'),
      phone: find(
        'phone',
        'phone number',
        'mobile',
        'mobile number',
        'mobile no',
        'mobile no.',
        'contact',
        'contact number',
        'contact no',
        'contact no.'
      ),
      skills: find(
        'skills',
        'primary skills',
        'skill set',
        'key skills',
        'special skills',
        'clinical skills',
        'skill',
        'key skill'
      ),
      location: find(
        'location',
        'current location',
        'city',
        'current city',
        'preferred location',
        'preferred city'
      ),
      preferredLocation: find('preferred location', 'preferred locations', 'preferred city', 'preferred cities'),
      experienceYears: find(
        'experience',
        'experience (years)',
        'total experience',
        'total exp',
        'total exp (years)',
        'experience years',
        'years of experience'
      ),
      experienceText: find('experience details', 'experience summary', 'work experience', 'experience (text)'),
      currentTitle: find('current title', 'role', 'current role', 'current position', 'position'),
      designation: find(
        'designation',
        'current designation',
        'title',
        'job title',
        'current title',
        'current company designation'
      ),
      currentCompany: find(
        'current company',
        'current company name',
        'company',
        'employer',
        'organization',
        'hospital',
        'current hospital',
        'current organisation'
      ),
      stream: find('stream', 'functional area', 'domain', 'category', 'specialization stream'),
      proficiency: find('proficiency', 'proficiency level', 'level', 'seniority', 'grade'),
      description: find(
        'description',
        'profile summary',
        'summary',
        'about',
        'bio',
        'candidate summary',
        'notes'
      ),
      specialization: find('specialization', 'speciality', 'department', 'speciality/department', 'department/speciality'),
      qualification: find('qualification', 'education', 'highest qualification', 'degree', 'educational qualification')
    };

    return {
      mapRow: (record) => {
        const values = Object.values(record);
        const getByIndex = (i) => (i >= 0 ? values[i] : undefined);

        return {
          firstName: getByIndex(idx.firstName),
          lastName: getByIndex(idx.lastName),
          fullName: getByIndex(idx.fullName),
          email: getByIndex(idx.email),
          phone: getByIndex(idx.phone),
          skills: getByIndex(idx.skills),
          location: getByIndex(idx.location),
          preferredLocation: getByIndex(idx.preferredLocation),
          experienceYears: getByIndex(idx.experienceYears),
          experienceText: getByIndex(idx.experienceText),
          currentTitle: getByIndex(idx.currentTitle),
          designation: getByIndex(idx.designation),
          currentCompany: getByIndex(idx.currentCompany),
          stream: getByIndex(idx.stream),
          proficiency: getByIndex(idx.proficiency),
          description: getByIndex(idx.description),
          specialization: getByIndex(idx.specialization),
          qualification: getByIndex(idx.qualification),
          raw: record
        };
      }
    };
  }
}
