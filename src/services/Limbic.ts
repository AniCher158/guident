import { Tensor } from 'onnxruntime-react-native';
import { TextEmotionResult } from '../types';
import { normalizeScores, topEmotion } from '../utils/emotion';
import { encode } from './Tokenizer';
import { ModelLoader } from './ModelLoader';

// DistilBERT label order from config.json: Caring, Excitement, Neutral, Sadness
// Map to the app's 8-emotion space
const DISTILBERT_TO_APP: Record<string, Partial<Record<TextEmotionResult['dominant'], number>>> = {
  Caring:     { hopeful: 0.6, calm: 0.4 },
  Excitement: { hopeful: 0.8, calm: 0.2 },
  Neutral:    { neutral: 0.9, calm: 0.1 },
  Sadness:    { sad: 0.7, lonely: 0.3 },
};
const LABELS = ['Caring', 'Excitement', 'Neutral', 'Sadness'];

function softmax(logits: Float32Array): number[] {
  const max = Math.max(...logits);
  const exps = Array.from(logits).map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

// ── keyword fallback (original Limbic logic) ────────────────────────────────
const weightedLexicon: Record<string, Partial<Record<TextEmotionResult['dominant'], number>>> = {
  anxious: { anxious: 2.4 }, anxiety: { anxious: 2.4 }, nervous: { anxious: 2.2 },
  panic: { overwhelmed: 2.8, anxious: 1.8 }, stressed: { overwhelmed: 2.4 },
  drowning: { overwhelmed: 2.7 }, exhausted: { overwhelmed: 2.2, sad: 1.1 },
  angry: { angry: 2.5 }, mad: { angry: 2.1 }, irritated: { angry: 1.8 },
  sad: { sad: 2.5 }, down: { sad: 2 }, empty: { sad: 2.3, lonely: 1.5 },
  lonely: { lonely: 2.8 }, alone: { lonely: 2.4 }, invisible: { lonely: 2.1 },
  calm: { calm: 2.2 }, okay: { calm: 1.2, neutral: 1.4 },
  hopeful: { hopeful: 2.4 }, better: { hopeful: 1.8 }, proud: { hopeful: 1.7, calm: 1.1 },
  confused: { overwhelmed: 1.7, anxious: 1.1 }, scared: { anxious: 2.3, overwhelmed: 1.4 },
  cry: { sad: 2.2 }, crying: { sad: 2.5 }, worthless: { sad: 2.8 },
  ashamed: { sad: 2.1, anxious: 1.2 }, school: { overwhelmed: 0.8 },
  exam: { anxious: 1.5 }, friend: { lonely: 0.7, hopeful: 0.4 },
  parents: { overwhelmed: 0.8, anxious: 0.4 },
};

function keywordFallback(input: string): TextEmotionResult {
  const base = { calm: 1, sad: 1, anxious: 1, overwhelmed: 1, angry: 1, lonely: 1, hopeful: 1, neutral: 1.2 };
  const rationale: string[] = ['DistilBERT unavailable — using keyword fallback.'];
  const tokens = input.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const entry = weightedLexicon[token as keyof typeof weightedLexicon];
    if (!entry) continue;
    rationale.push(`Matched cue: "${token}"`);
    for (const [emotion, weight] of Object.entries(entry)) {
      base[emotion as keyof typeof base] += weight ?? 0;
    }
  }
  if (input.includes('!')) { base.overwhelmed += 0.6; rationale.push('Exclamation detected.'); }
  if (input.length > 180) { base.overwhelmed += 0.4; rationale.push('Long message detected.'); }
  const scores = normalizeScores(base);
  return { dominant: topEmotion(scores), scores, rationale };
}

export class LimbicService {
  async analyzeText(input: string): Promise<TextEmotionResult> {
    const session = ModelLoader.distilbert;
    if (!session) return keywordFallback(input);

    try {
      const { inputIds, attentionMask } = encode(input);
      const seqLen = inputIds.length;

      const feeds = {
        input_ids: new Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, seqLen]),
        attention_mask: new Tensor('int64', BigInt64Array.from(attentionMask.map(BigInt)), [1, seqLen]),
      };
      const results = await session.run(feeds);

      const logits = results['logits']?.data as Float32Array;
      const probs = softmax(logits);
      const dominant = LABELS[probs.indexOf(Math.max(...probs))];
      const mapped = DISTILBERT_TO_APP[dominant] ?? { neutral: 1 };

      const base = { calm: 1, sad: 1, anxious: 1, overwhelmed: 1, angry: 1, lonely: 1, hopeful: 1, neutral: 1 };
      for (const [emo, w] of Object.entries(mapped)) {
        base[emo as keyof typeof base] += (w ?? 0) * 5;
      }
      const scores = normalizeScores(base);

      return {
        dominant: topEmotion(scores),
        scores,
        rationale: [
          `DistilBERT empathy: ${LABELS.map((l, i) => `${l} ${(probs[i] * 100).toFixed(1)}%`).join(', ')}`,
          `Mapped dominant "${dominant}" → app emotion space.`,
        ],
      };
    } catch (e) {
      console.warn('[Limbic] DistilBERT inference failed, falling back:', e);
      return keywordFallback(input);
    }
  }
}

export const Limbic = new LimbicService();
