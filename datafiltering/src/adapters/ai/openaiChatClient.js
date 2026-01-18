import { AiChatClient } from '../../ports/aiChatClient.js';

export class OpenAiChatClient extends AiChatClient {
  constructor({ apiKey, model, baseUrl = 'https://api.openai.com/v1', logger }) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  async chat({ system, user, temperature = 0 }) {
    if (!this.apiKey) throw new Error('Missing OPENAI_API_KEY');
    const model = this.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        parsed = null;
      }

      const code = parsed?.error?.code;
      const message = parsed?.error?.message;

      if (this.logger) {
        this.logger.error(
          { status: res.status, code, message, text },
          'openai request failed'
        );
      }

      if (res.status === 429 && code === 'insufficient_quota') {
        throw new Error(
          'OpenAI error: insufficient_quota (429). Your OpenAI project has no available quota. '
            + 'Enable billing / add a payment method or increase hard limits in the OpenAI dashboard, '
            + 'or switch AI_PROVIDER to claude/gemini.'
        );
      }

      if (typeof message === 'string' && message.trim()) {
        throw new Error(`OpenAI API error: ${res.status}${code ? ` (${code})` : ''}: ${message}`);
      }

      throw new Error(`OpenAI API error: ${res.status}${code ? ` (${code})` : ''}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('OpenAI response missing message content');
    }

    return { text: content };
  }
}
