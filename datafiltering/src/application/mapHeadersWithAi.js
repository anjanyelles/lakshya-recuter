import { buildAiHeaderMappingPrompt } from '../adapters/mapping/aiHeaderMappingPrompt.js';
import {
  mappingToDictionary,
  safeParseAiHeaderMappingResponse
} from '../adapters/mapping/aiHeaderMappingResponse.js';

export async function mapHeadersWithAi({
  aiClient,
  headers,
  sampleRows = [],
  canonicalFields,
  logger
}) {
  const prompt = buildAiHeaderMappingPrompt({
    headers,
    canonicalFields,
    sampleRows
  });

  if (logger) {
    logger.info(
      { headerCount: headers.length, sampleRows: sampleRows.length },
      'building ai header mapping prompt'
    );
  }

  const { text } = await aiClient.chat({
    system: prompt.system,
    user: prompt.user,
    temperature: 0
  });

  const parsed = safeParseAiHeaderMappingResponse({ text, inputHeaders: headers });
  if (!parsed.ok) {
    if (logger) {
      logger.warn(
        { code: parsed.error.code, message: parsed.error.message },
        'failed to parse ai header mapping response'
      );
    }

    return {
      raw: null,
      dictionary: {},
      error: parsed.error
    };
  }

  return {
    raw: parsed.value,
    dictionary: mappingToDictionary(parsed.value)
  };
}
