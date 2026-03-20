import { Tensor } from 'onnxruntime-react-native';
import { TextEmotionResult } from '../types/index';
import { normalizeScores, topEmotion } from '../utils/emotion';
import { encode } from './Tokenizer';
import { ModelLoader } from './ModelLoader';
import { analyzeTextKeywords } from '../emotion/keyword_text_analysis';

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

export class LimbicService {
  async analyzeText(input: string): Promise<TextEmotionResult> {
    const session = ModelLoader.distilbert;
    if (!session) {
      const fallback = analyzeTextKeywords(input);
      return {
        ...fallback,
        rationale: ['DistilBERT unavailable — using keyword fallback.', ...fallback.rationale.slice(1)],
      };
    }

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
      const fallback = analyzeTextKeywords(input);
      return {
        ...fallback,
        rationale: ['DistilBERT inference failed — using keyword fallback.', ...fallback.rationale.slice(1)],
      };
    }
  }
}

export const Limbic = new LimbicService();
