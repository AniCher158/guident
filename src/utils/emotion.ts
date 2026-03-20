import { EmotionLabel, EmotionScore } from '../types/index';

export const EMOTION_ORDER: EmotionLabel[] = [
  'overwhelmed',
  'anxious',
  'sad',
  'angry',
  'lonely',
  'hopeful',
  'calm',
  'neutral',
];

export function normalizeScores(entries: Record<EmotionLabel, number>): EmotionScore[] {
  const total = Object.values(entries).reduce((sum, value) => sum + value, 0) || 1;

  return EMOTION_ORDER.map((label) => ({
    label,
    score: Number((entries[label] / total).toFixed(3)),
  })).sort((a, b) => b.score - a.score);
}

export function topEmotion(entries: EmotionScore[]): EmotionLabel {
  return entries[0]?.label ?? 'neutral';
}
