import { FaceEmotionResult, FusionResult, TextEmotionResult } from '../types/index';
import { detectModalityDisagreement } from './disagreement';
import { faceSignalToScores, scoresToRecord, topTwoGap } from './utils';
import { normalizeScores, topEmotion } from '../utils/emotion';

export function confidenceWeightedFusion(text: TextEmotionResult, face?: FaceEmotionResult): FusionResult {
  const usableFace = face?.source === 'quality-gated' ? undefined : face;
  const textRecord = scoresToRecord(text.scores);
  const faceScores = usableFace ? faceSignalToScores(usableFace.dominant, usableFace.confidence) : undefined;
  const faceRecord = faceScores ? scoresToRecord(faceScores) : undefined;
  const disagreement = detectModalityDisagreement(text, usableFace);

  const textCertainty = topTwoGap(text.scores);
  const faceReliability = usableFace ? Math.min(0.9, Math.max(0.1, usableFace.confidence)) : 0;
  const faceBoost = usableFace ? Math.max(0, faceReliability - textCertainty * 0.5 - disagreement.score * 0.35) : 0;
  const rawImageWeight = usableFace ? Math.min(0.4, 0.08 + faceBoost) : 0;
  const imageWeight = Number(rawImageWeight.toFixed(3));
  const textWeight = Number((1 - imageWeight).toFixed(3));

  const fusedBase = { ...textRecord };
  for (const label of Object.keys(fusedBase) as Array<keyof typeof fusedBase>) {
    fusedBase[label] = fusedBase[label] * textWeight + (faceRecord?.[label] ?? 0) * imageWeight;
  }
  const fusedScores = normalizeScores(fusedBase);
  const dominant = topEmotion(fusedScores);
  const confidence = Number(Math.min(0.98, fusedScores[0]?.score ?? 0).toFixed(3));

  return {
    dominant,
    scores: fusedScores,
    confidence,
    textWeight,
    imageWeight,
    disagreementScore: disagreement.score,
    disagreementHigh: disagreement.isHigh,
    textDominant: text.dominant,
    faceDominant: usableFace?.dominant,
    rationale: [
      `Text weight ${Math.round(textWeight * 100)}% based on text certainty ${textCertainty.toFixed(3)}.`,
      usableFace
        ? `Image weight ${Math.round(imageWeight * 100)}% from face confidence ${usableFace.confidence.toFixed(3)} and disagreement ${disagreement.score.toFixed(3)}.`
        : face?.source === 'quality-gated'
          ? 'Image signal was quality-gated away, so text carries the full fusion.'
        : 'No image signal, so text carries the full fusion.',
      ...disagreement.rationale,
    ],
  };
}
