import { OpenAiChatClient } from './openaiChatClient.js';
import { AnthropicChatClient } from './anthropicChatClient.js';
import { GeminiChatClient } from './geminiChatClient.js';

export function createAiClientFromEnv({ logger } = {}) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  if (provider === 'openai') {
    return new OpenAiChatClient({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
      baseUrl: process.env.OPENAI_BASE_URL,
      logger
    });
  }

  if (provider === 'anthropic' || provider === 'claude') {
    return new AnthropicChatClient({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL,
      baseUrl: process.env.ANTHROPIC_BASE_URL,
      logger
    });
  }

  if (provider === 'gemini' || provider === 'google') {
    return new GeminiChatClient({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL,
      baseUrl: process.env.GEMINI_BASE_URL,
      logger
    });
  }

  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}
