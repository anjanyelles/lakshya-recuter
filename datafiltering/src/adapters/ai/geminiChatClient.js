import { AiChatClient } from '../../ports/aiChatClient.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiChatClient extends AiChatClient {
  constructor({ apiKey, model, baseUrl = 'https://generativelanguage.googleapis.com', logger }) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  buildUrl({ apiVersion, model }) {
    const normalizedModel = String(model || '').replace(/^models\//, '');
    return `${this.baseUrl}/${apiVersion}/models/${encodeURIComponent(normalizedModel)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
  }

  buildListModelsUrl({ apiVersion }) {
    return `${this.baseUrl}/${apiVersion}/models?key=${encodeURIComponent(this.apiKey)}`;
  }

  async listModels({ apiVersion }) {
    const url = this.buildListModelsUrl({ apiVersion });
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, rawText: text };
    }

    const json = await res.json().catch(() => null);
    const models = Array.isArray(json?.models) ? json.models : [];
    return { ok: true, models };
  }

  pickModelFromList(models) {
    for (const m of models) {
      const name = m?.name;
      const methods = Array.isArray(m?.supportedGenerationMethods)
        ? m.supportedGenerationMethods
        : [];

      if (typeof name === 'string' && methods.includes('generateContent')) {
        return name.replace(/^models\//, '');
      }
    }
    return null;
  }

  async requestOnce({ apiVersion, model, temperature, system, user }) {
    const url = this.buildUrl({ apiVersion, model });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: {
          temperature
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: `${system}\n\n${user}` }]
          }
        ]
      })
    });

    if (res.ok) {
      const json = await res.json();
      const outText = json?.candidates?.[0]?.content?.parts
        ? json.candidates[0].content.parts.map((p) => p.text || '').join('')
        : null;

      if (typeof outText !== 'string') {
        throw new Error('Gemini response missing text');
      }

      return { ok: true, text: outText };
    }

    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = null;
    }

    const message = parsed?.error?.message;
    const code = parsed?.error?.status;

    return {
      ok: false,
      status: res.status,
      apiVersion,
      model,
      code,
      message,
      rawText: text
    };
  }

  async chat({ system, user, temperature = 0 }) {
    if (!this.apiKey) throw new Error('Missing GEMINI_API_KEY');

    const useSdk = (process.env.GEMINI_USE_SDK || 'true').toLowerCase() !== 'false';
    if (useSdk) {
      const baseModel = this.model || process.env.GEMINI_MODEL || 'gemini-1.5-pro';
      const normalizedModel = String(baseModel).replace(/^models\//, '');

      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: normalizedModel });

      const prompt = `${system}\n\n${user}`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature }
      });

      const text = result?.response?.text?.();
      if (typeof text !== 'string') {
        throw new Error('Gemini SDK response missing text');
      }

      return { text };
    }

    const baseModel = this.model || process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    const envApiVersion = process.env.GEMINI_API_VERSION;
    const preferredApiVersion = typeof envApiVersion === 'string' && envApiVersion.trim() ? envApiVersion.trim() : 'v1beta';

    const normalizedBaseModel = String(baseModel).replace(/^models\//, '');
    const modelCandidates = [normalizedBaseModel];

    // The Generative Language API commonly exposes numeric suffixed model IDs.
    // When the user provides a non-suffixed model (e.g. gemini-1.5-flash), try common variants.
    const hasNumericSuffix = /-\d{3}$/.test(normalizedBaseModel);
    if (!hasNumericSuffix) {
      modelCandidates.push(`${normalizedBaseModel}-002`);
      modelCandidates.push(`${normalizedBaseModel}-001`);
    }

    const apiVersionCandidates = preferredApiVersion === 'v1'
      ? ['v1', 'v1beta']
      : ['v1beta', 'v1'];

    let lastErr = null;
    for (const apiVersion of apiVersionCandidates) {
      for (const model of modelCandidates) {
        const attempt = await this.requestOnce({ apiVersion, model, temperature, system, user });
        if (attempt.ok) return { text: attempt.text };

        lastErr = attempt;

        // Only retry other variants for "not found".
        if (!(attempt.status === 404 && attempt.code === 'NOT_FOUND')) {
          break;
        }
      }
    }

    if (lastErr && lastErr.status === 404 && lastErr.code === 'NOT_FOUND') {
      const autoDiscovery = (process.env.GEMINI_AUTO_MODEL_DISCOVERY || 'true').toLowerCase() !== 'false';
      if (autoDiscovery) {
        for (const apiVersion of apiVersionCandidates) {
          const list = await this.listModels({ apiVersion });
          if (!list.ok) continue;
          const picked = this.pickModelFromList(list.models);
          if (!picked) continue;

          const attempt = await this.requestOnce({ apiVersion, model: picked, temperature, system, user });
          if (attempt.ok) return { text: attempt.text };

          lastErr = attempt;
        }
      }
    }

    if (this.logger && lastErr) {
      this.logger.error(
        {
          status: lastErr.status,
          apiVersion: lastErr.apiVersion,
          model: lastErr.model,
          code: lastErr.code,
          message: lastErr.message,
          text: lastErr.rawText
        },
        'gemini request failed'
      );
    }

    if (lastErr && typeof lastErr.message === 'string' && lastErr.message.trim()) {
      throw new Error(`Gemini API error: ${lastErr.status}${lastErr.code ? ` (${lastErr.code})` : ''}: ${lastErr.message}`);
    }

    throw new Error('Gemini API error');
  }
}
