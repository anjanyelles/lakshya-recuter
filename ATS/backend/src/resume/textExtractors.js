import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractTextFromResume({ buffer, contentType, filename }) {
  const name = String(filename || '').toLowerCase();

  if (contentType === 'application/pdf' || name.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return data.text || '';
  }

  if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    const res = await mammoth.extractRawText({ buffer });
    return res.value || '';
  }

  // .doc extraction is not supported reliably without heavy deps; keep best-effort.
  return '';
}
