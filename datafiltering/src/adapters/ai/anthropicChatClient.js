import { AiChatClient } from '../../ports/aiChatClient.js';

export class AnthropicChatClient extends AiChatClient {
  constructor({ apiKey, model, baseUrl = 'https://api.anthropic.com/v1', logger }) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  async chat({ system, user, temperature = 0 }) {
    if (!this.apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
    const model = this.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });

    if (!res.ok) {
      const text = await res.text();
      if (this.logger) this.logger.error({ status: res.status, text }, 'anthropic request failed');
      throw new Error(`Anthropic API error: ${res.status}`);
    }

    const json = await res.json();
    const blocks = json?.content;
    const text = Array.isArray(blocks)
      ? blocks
          .filter((b) => b?.type === 'text')
          .map((b) => b.text)
          .join('')
      : null;

    if (typeof text !== 'string') {
      throw new Error('Anthropic response missing text');
    }

    return { text };
  }
}
