export const DEFAULT_CANONICAL_FIELDS = [
  {
    key: 'fullName',
    description: 'Candidate full name (person name)'
  },
  {
    key: 'email',
    description: 'Primary email address'
  },
  {
    key: 'phone',
    description: 'Primary phone/mobile number'
  },
  {
    key: 'designation',
    description: 'Current title/designation/role'
  },
  {
    key: 'currentCompany',
    description: 'Current employer/company/organization'
  },
  {
    key: 'experienceYears',
    description: 'Total years of experience as a number (e.g. 3.5)'
  },
  {
    key: 'skills',
    description: 'Skills or skill set (may be comma-separated in source)'
  },
  {
    key: 'location',
    description: 'Current location / city'
  }
];

export function buildAiHeaderMappingPrompt({
  headers,
  canonicalFields = DEFAULT_CANONICAL_FIELDS,
  sampleRows = [],
  instructions = {}
}) {
  if (!Array.isArray(headers) || headers.length === 0) {
    throw new Error('headers must be a non-empty array');
  }

  const {
    allowManyToOne = true,
    requireConfidence = true,
    allowUnmapped = true,
    requireOnlyJson = true
  } = instructions;

  const canonical = canonicalFields.map((f) => ({
    key: f.key,
    description: f.description
  }));

  const system =
    'You are a data ingestion assistant. Your job is to map messy spreadsheet column headers to a predefined canonical schema. '
    + 'Return ONLY valid JSON. Do not include markdown, code fences, or explanation text outside JSON.';

  const user = {
    task: 'Map the given Excel headers to canonical candidate fields.',
    rules: {
      outputFormat: 'json',
      requireOnlyJson,
      allowManyToOne,
      allowUnmapped,
      requireConfidence,
      constraints: [
        'Do not hallucinate headers that are not present.',
        'Prefer exact/strong semantic matches (e.g., "Candidate Name" -> fullName, "Mobile no" -> phone).',
        'If a header is ambiguous, set targetField to null and explain briefly in reason.',
        'If multiple headers map to the same targetField, choose a primary sourceHeader and mark others as aliases.'
      ]
    },
    canonicalFields: canonical,
    input: {
      headers,
      sampleRows: sampleRows.slice(0, 5)
    },
    outputSchema: {
      version: '1.0',
      mappings: [
        {
          sourceHeader: 'string (must be one of input.headers)',
          targetField: 'string|null (must be one of canonicalFields[].key or null)',
          confidence: 'number 0..1',
          isPrimary: 'boolean',
          aliases: 'string[] (other headers that mean the same thing)',
          reason: 'string (short)'
        }
      ]
    },
    examples: {
      headers: ['Candidate Name', 'ADRENALIN_NAME', 'Mobile no', 'Email ID', 'Current Company'],
      expected: {
        version: '1.0',
        mappings: [
          {
            sourceHeader: 'Candidate Name',
            targetField: 'fullName',
            confidence: 0.95,
            isPrimary: true,
            aliases: ['ADRENALIN_NAME'],
            reason: 'Both columns represent the candidate name.'
          },
          {
            sourceHeader: 'Mobile no',
            targetField: 'phone',
            confidence: 0.95,
            isPrimary: true,
            aliases: [],
            reason: 'Mobile number.'
          },
          {
            sourceHeader: 'Email ID',
            targetField: 'email',
            confidence: 0.95,
            isPrimary: true,
            aliases: [],
            reason: 'Email address.'
          },
          {
            sourceHeader: 'Current Company',
            targetField: 'currentCompany',
            confidence: 0.9,
            isPrimary: true,
            aliases: [],
            reason: 'Employer/company.'
          }
        ]
      }
    }
  };

  return {
    system,
    user: JSON.stringify(user, null, 2)
  };
}
