import * as FileSystem from 'expo-file-system/legacy';
import { EmotionLabel, SupportReply } from '../types/index';
import { mergeParsedReply, parsePhiStyleOutput } from './ModelOutputParser';

type LlamaModule = {
  initLlama?: (options: Record<string, unknown>) => Promise<unknown>;
};

interface LocalLLMStatus {
  status: 'ready' | 'fallback' | 'unavailable';
  detail: string;
  modelPath?: string;
}

interface ReplyContext {
  emotion: EmotionLabel;
  userText: string;
}

const CANDIDATE_MODEL_PATHS = ['phi2_q4.gguf', 'Phi-2/phi2_q4.gguf'];

const state: {
  ctx: null | { completion?: (options: Record<string, unknown>) => Promise<unknown> };
  initPromise: Promise<void> | null;
  status: LocalLLMStatus;
} = {
  ctx: null,
  initPromise: null,
  status: {
    status: 'fallback',
    detail: 'No local GGUF model detected. Using template reply fallback.',
  },
};

function buildPrompt({ emotion, userText }: ReplyContext): string {
  return [
    'You are Guident, a supportive reflection assistant for teenagers.',
    `Detected emotion: ${emotion}.`,
    'Return JSON only with keys recognition, validation, guidance, followUp.',
    'recognition: one sentence.',
    'validation: one sentence.',
    'guidance: array of exactly 2 short CBT-style coping steps.',
    'followUp: one short optional question.',
    'Do not mention diagnosis, do not mention being a therapist, do not mention policy.',
    `User message: ${JSON.stringify(userText)}`,
  ].join('\n');
}

async function runCompletion(prompt: string): Promise<string> {
  if (!state.ctx?.completion) return '';

  const raw = await state.ctx.completion({
    prompt,
    n_predict: 200,
    temperature: 0.3,
    top_p: 0.9,
    stop: ['\n\nUser:', '\n\nUSER:', '</s>'],
  });

  return extractText(raw);
}

function extractText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return '';

  const candidate = result as Record<string, unknown>;
  if (typeof candidate.text === 'string') return candidate.text;
  if (typeof candidate.content === 'string') return candidate.content;
  if (typeof candidate.response === 'string') return candidate.response;
  if (Array.isArray(candidate.choices)) {
    const first = candidate.choices[0] as Record<string, unknown> | undefined;
    if (first && typeof first.text === 'string') return first.text;
  }
  return '';
}

async function resolveModelPath(): Promise<string | undefined> {
  const base = FileSystem.documentDirectory;
  if (!base) return undefined;

  for (const relativePath of CANDIDATE_MODEL_PATHS) {
    const uri = `${base}${relativePath}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) return uri;
  }

  return undefined;
}

async function loadContext(modelPath: string) {
  const module = (await import('llama.rn')) as LlamaModule;
  if (!module.initLlama) {
    throw new Error('llama.rn initLlama() not available.');
  }

  const maybeContext = await module.initLlama({
    model: modelPath,
    n_ctx: 2048,
    n_threads: 4,
    n_gpu_layers: 0,
    use_mlock: false,
    use_mmap: true,
    embedding: false,
  });

  if (!maybeContext || typeof maybeContext !== 'object') {
    throw new Error('llama.rn returned an invalid context.');
  }

  const context = maybeContext as { completion?: (options: Record<string, unknown>) => Promise<unknown> };
  if (typeof context.completion !== 'function') {
    throw new Error('llama.rn context has no completion() method.');
  }

  return context;
}

export const LocalLLM = {
  async init(): Promise<void> {
    if (state.initPromise) return state.initPromise;

    state.initPromise = (async () => {
      const modelPath = await resolveModelPath();
      if (!modelPath) {
        state.status = {
          status: 'fallback',
          detail: 'No sideloaded GGUF model found in app documents. Using template reply fallback.',
        };
        return;
      }

      try {
        state.ctx = await loadContext(modelPath);
        state.status = {
          status: 'ready',
          detail: 'Local llama.rn model loaded from app documents.',
          modelPath,
        };
      } catch (error) {
        state.ctx = null;
        state.status = {
          status: 'fallback',
          detail: `Local model found but failed to load: ${error instanceof Error ? error.message : String(error)}`,
          modelPath,
        };
      }
    })();

    return state.initPromise;
  },

  getStatus(): LocalLLMStatus {
    return { ...state.status };
  },

  async generateReply(context: ReplyContext, fallback: SupportReply): Promise<SupportReply> {
    await this.init();
    if (!state.ctx?.completion) return fallback;

    try {
      const parsed = parsePhiStyleOutput(await runCompletion(buildPrompt(context)));
      return mergeParsedReply(fallback, parsed);
    } catch (error) {
      console.warn('[LocalLLM] Generation failed, using fallback:', error);
      return fallback;
    }
  },

  async generateStructured(prompt: string, fallback: SupportReply): Promise<{ reply: SupportReply; rawText: string; usedModel: boolean; source: string }> {
    await this.init();
    if (!state.ctx?.completion) {
      return { reply: fallback, rawText: '', usedModel: false, source: 'fallback-template' };
    }

    try {
      const rawText = await runCompletion(prompt);
      const parsed = parsePhiStyleOutput(rawText);
      return {
        reply: mergeParsedReply(fallback, parsed),
        rawText,
        usedModel: true,
        source: 'local-llm-structured',
      };
    } catch (error) {
      console.warn('[LocalLLM] Structured generation failed, using fallback:', error);
      return { reply: fallback, rawText: '', usedModel: false, source: 'fallback-template' };
    }
  },
};
