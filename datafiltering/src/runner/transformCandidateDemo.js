import { transformCandidateRow } from '../utils/candidateTransform.js';

export async function main() {
  const row = {
    'Candidate Name': '  John   Doe  ',
    'Email ID': ' JOHN.DOE@Example.COM ',
    Phone: '(+91) 98765-43210',
    Skills: 'React, Node.js; PostgreSQL | AWS',
    Location: '  Bengaluru  '
  };

  // Mapping is canonicalField -> sourceHeader
  const mapping = {
    fullName: 'Candidate Name',
    email: 'Email ID',
    phone: 'Phone',
    skills: 'Skills',
    location: 'Location'
  };

  const candidate = transformCandidateRow({
    row,
    mapping,
    options: {
      phone: { defaultCountryCode: '91' }
    }
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(candidate, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err?.message || String(err));
    process.exitCode = 1;
  });
}
