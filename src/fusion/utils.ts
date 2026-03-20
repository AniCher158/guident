import { EmotionLabel, EmotionScore } from '../types/index';
import { EMOTION_ORDER, normalizeScores } from '../utils/emotion';

export function scoresToRecord(scores: EmotionScore[]): Record<EmotionLabel, number> {
  const base = Object.fromEntries(EMOTION_ORDER.map((label) => [label, 0])) as Record<EmotionLabel, number>;
  for (const item of scores) {
    base[item.label] = item.score;
  }
  return base;
}

export function faceSignalToScores(dominant: EmotionLabel, confidence: number): EmotionScore[] {
  const floor = Math.max(0.02, (1 - confidence) / EMOTION_ORDER.length);
  const record = Object.fromEntries(EMOTION_ORDER.map((label) => [label, floor])) as Record<EmotionLabel, number>;
  record[dominant] += confidence;
  return normalizeScores(record);
}

export function topTwoGap(scores: EmotionScore[]): number {
  const first = scores[0]?.score ?? 0;
  const second = scores[1]?.score ?? 0;
  return Number(Math.max(0, first - second).toFixed(3));
}
