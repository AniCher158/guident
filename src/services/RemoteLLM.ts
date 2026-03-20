import { SupportReply } from '../types/index';
import { mergeParsedReply, parsePhiStyleOutput } from './ModelOutputParser';

interface RemoteLLMStatus {
  status: 'ready' | 'fallback' | 'unavailable';
  detail: string;
  model?: string;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_GUIDENT_API_BASE_URL?.trim();
const MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
const CONNECTION_RETRY_COOLDOWN_MS = 60_000;

let lastConnectionFailureAt = 0;
let lastConnectionFailureMessage = '';
let disabledForSession = false;

function connectionCoolingDown(): boolean {
  return Date.now() - lastConnectionFailureAt < CONNECTION_RETRY_COOLDOWN_MS;
}

function markConnectionFailure(message: string): void {
  lastConnectionFailureAt = Date.now();
  lastConnectionFailureMessage = message;
}

function clearConnectionFailure(): void {
  lastConnectionFailureAt = 0;
  lastConnectionFailureMessage = '';
}

export const RemoteLLM = {
  getStatus(): RemoteLLMStatus {
    if (!API_BASE_URL) {
      return {
        status: 'fallback',
        detail: 'No EXPO_PUBLIC_GUIDENT_API_BASE_URL configured. Backend LLM replies are disabled.',
      };
    }
    if (disabledForSession) {
      return {
        status: 'fallback',
        detail: `Backend LLM disabled for this app session after a network failure: ${lastConnectionFailureMessage || 'connection error'}.`,
        model: MODEL,
      };
    }
    if (connectionCoolingDown()) {
      return {
        status: 'fallback',
        detail: `Backend LLM temporarily disabled after a connection failure: ${lastConnectionFailureMessage || 'connection error'}.`,
        model: MODEL,
      };
    }

    return {
      status: 'ready',
      detail: `Backend LLM replies enabled via ${API_BASE_URL}.`,
      model: MODEL,
    };
  },

  async generateStructured(prompt: string, fallback: SupportReply): Promise<{ reply: SupportReply; rawText: string; usedModel: boolean; source: string }> {
    if (!API_BASE_URL) {
      return { reply: fallback, rawText: '', usedModel: false, source: 'remote-disabled' };
    }
    if (disabledForSession) {
      return { reply: fallback, rawText: '', usedModel: false, source: 'remote-session-disabled' };
    }
    if (connectionCoolingDown()) {
      return { reply: fallback, rawText: '', usedModel: false, source: 'remote-cooldown' };
    }

    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          input: prompt,
          temperature: 0.35,
        }),
      });

      const rawJson = await response.json();
      if (!response.ok) {
        const errorMessage = typeof rawJson?.error?.message === 'string'
          ? rawJson.error.message
          : `HTTP ${response.status}`;
        if (response.status >= 500 || response.status === 0) {
          markConnectionFailure(errorMessage);
        }
        console.warn('[RemoteLLM] Structured generation failed, falling back:', errorMessage);
        return { reply: fallback, rawText: '', usedModel: false, source: 'remote-error' };
      }

      clearConnectionFailure();
      const rawText = typeof rawJson?.output_text === 'string'
        ? rawJson.output_text
        : '';
      const parsed = parsePhiStyleOutput(rawText);
      return {
        reply: mergeParsedReply(fallback, parsed),
        rawText,
        usedModel: true,
        source: `backend-openai:${MODEL}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection error.';
      markConnectionFailure(message);
      disabledForSession = true;
      console.warn('[RemoteLLM] Backend request failed, disabling remote replies for this session:', message);
      return { reply: fallback, rawText: '', usedModel: false, source: 'remote-error' };
    }
  },
};
