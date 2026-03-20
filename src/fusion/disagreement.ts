import { FaceEmotionResult, TextEmotionResult } from '../types/index';
import { topTwoGap } from './utils';

export interface ModalityDisagreement {
  score: number;
  isHigh: boolean;
  rationale: string[];
}

export function detectModalityDisagreement(text: TextEmotionResult, face?: FaceEmotionResult): ModalityDisagreement {
  const gatedAway = face?.source === 'quality-gated';
  if (!face || gatedAway) {
    return {
      score: 0,
      isHigh: false,
      rationale: [gatedAway ? 'Face signal was quality-gated away, so disagreement is 0.' : 'No face signal, so disagreement is 0.'],
    };
  }

  const differentDominant = text.dominant !== face.dominant ? 1 : 0;
  const textMarginPenalty = 1 - topTwoGap(text.scores);
  const faceStrength = Math.min(1, Math.max(0, face.confidence));
  const score = Number((differentDominant * 0.55 + textMarginPenalty * 0.2 + faceStrength * 0.25).toFixed(3));

  return {
    score,
    isHigh: score >= 0.6,
    rationale: [
      differentDominant ? `Text and face disagree (${text.dominant} vs ${face.dominant}).` : 'Text and face agree on the dominant emotion.',
      `Text certainty margin: ${topTwoGap(text.scores).toFixed(3)}.`,
      `Face confidence: ${face.confidence.toFixed(3)}.`,
    ],
  };
}
