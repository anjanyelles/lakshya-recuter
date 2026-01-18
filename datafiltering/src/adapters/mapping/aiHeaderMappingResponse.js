const CANONICAL_KEYS = new Set([
  'fullName',
  'email',
  'phone',
  'designation',
  'currentCompany',
  'experienceYears',
  'skills',
  'location'
]);

function extractJsonCandidate(text) {
  if (typeof text !== 'string') return null;

  const unfenced = text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = unfenced.indexOf('{');
  const lastBrace = unfenced.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return unfenced.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = unfenced.indexOf('[');
  const lastBracket = unfenced.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return unfenced.slice(firstBracket, lastBracket + 1);
  }

  return null;
}

function safeJsonParse(text) {
  const candidate = extractJsonCandidate(text) || text;
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        message: 'AI response is not valid JSON',
        details: e?.message || String(e)
      }
    };
  }
}

function isNumber01(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
}

export function parseAiHeaderMappingResponse({ text, inputHeaders }) {
  if (!Array.isArray(inputHeaders) || inputHeaders.length === 0) {
    throw new Error('inputHeaders must be a non-empty array');
  }

  let data;
  try {
    const parsed = safeJsonParse(text);
    if (!parsed.ok) throw new Error(parsed.error.message);
    data = parsed.value;
  } catch (e) {
    throw new Error('AI response is not valid JSON');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('AI response JSON must be an object');
  }

  if (!Array.isArray(data.mappings)) {
    throw new Error('AI response JSON must contain mappings: []');
  }

  const headerSet = new Set(inputHeaders);

  const normalized = [];
  for (const m of data.mappings) {
    if (!m || typeof m !== 'object') {
      throw new Error('Each mapping must be an object');
    }

    const sourceHeader = m.sourceHeader;
    if (typeof sourceHeader !== 'string' || !headerSet.has(sourceHeader)) {
      throw new Error('mapping.sourceHeader must be one of the provided headers');
    }

    const targetField = m.targetField;
    if (!(targetField === null || (typeof targetField === 'string' && CANONICAL_KEYS.has(targetField)))) {
      throw new Error('mapping.targetField must be null or a valid canonical key');
    }

    const confidence = m.confidence;
    if (!isNumber01(confidence)) {
      throw new Error('mapping.confidence must be a number between 0 and 1');
    }

    const isPrimary = Boolean(m.isPrimary);
    const aliases = Array.isArray(m.aliases)
      ? m.aliases.filter((a) => typeof a === 'string' && headerSet.has(a) && a !== sourceHeader)
      : [];

    const reason = typeof m.reason === 'string' ? m.reason : '';

    normalized.push({
      sourceHeader,
      targetField,
      confidence,
      isPrimary,
      aliases,
      reason
    });
  }

  return {
    version: typeof data.version === 'string' ? data.version : '1.0',
    mappings: normalized
  };
}

export function safeParseAiHeaderMappingResponse({ text, inputHeaders }) {
  try {
    const value = parseAiHeaderMappingResponse({ text, inputHeaders });
    return { ok: true, value };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'INVALID_AI_MAPPING',
        message: e?.message || 'Failed to parse AI mapping response',
        rawText: typeof text === 'string' ? text : ''
      }
    };
  }
}

export function mappingToDictionary(parsed) {
  const out = {};
  for (const m of parsed.mappings) {
    if (!m.targetField) continue;
    if (m.isPrimary) {
      out[m.targetField] = m.sourceHeader;
    }
  }
  return out;
}
