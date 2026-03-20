import { CrisisAssessment, FusionResult, TextEmotionResult } from '../types/index';

export interface DistressAssessment {
  level: 'low' | 'medium' | 'high';
  score: number;
  rationale: string[];
}

export function assessDistressIntensity(
  input: string,
  text: TextEmotionResult,
  fusion: FusionResult,
  crisis: CrisisAssessment,
): DistressAssessment {
  if (crisis.level === 'high') {
    return {
      level: 'high',
      score: Number(Math.max(0.92, crisis.score).toFixed(3)),
      rationale: ['High-risk crisis cues force distress to high.', ...crisis.rationale.slice(0, 2)],
    };
  }

  let score = 0.12;
  const lowered = input.toLowerCase();
  const cues = ['overwhelmed', 'hopeless', 'pointless', 'alone', 'tense', 'cannot cope', "can't cope", 'unsafe', 'trapped', 'exhausted'];
  const amplifiers = ['really', 'so', 'extremely', 'completely', 'barely'];
  const topTextScore = text.scores[0]?.score ?? 0;
  const topTwoGap = (text.scores[0]?.score ?? 0) - (text.scores[1]?.score ?? 0);
  const negativeHits = cues.filter((cue) => lowered.includes(cue)).length;
  const amplifierHits = amplifiers.filter((cue) => lowered.includes(cue)).length;
  const recoverySignals = ['better', 'handled it', 'got through', 'calmer', 'safe now'].filter((cue) => lowered.includes(cue)).length;

  score += Math.min(0.32, topTextScore);
  if (['anxious', 'overwhelmed', 'sad', 'angry', 'lonely'].includes(fusion.dominant)) score += 0.18;
  if (fusion.disagreementHigh) score += 0.1;
  if (input.length > 180) score += 0.05;
  score += Math.min(0.24, negativeHits * 0.06);
  score += Math.min(0.08, amplifierHits * 0.02);
  score += Math.max(0, 0.08 - topTwoGap * 0.2);
  score += crisis.score * 0.25;
  score -= Math.min(0.12, recoverySignals * 0.04);
  if (crisis.level === 'medium') score += 0.14;

  const clamped = Number(Math.min(0.99, score).toFixed(3));
  const level = clamped >= 0.75 ? 'high' : clamped >= 0.38 ? 'medium' : 'low';

  return {
    level,
    score: clamped,
    rationale: [
      `Top text confidence contributed ${topTextScore.toFixed(3)}.`,
      `Text certainty gap was ${topTwoGap.toFixed(3)}.`,
      `Fused dominant emotion is ${fusion.dominant}.`,
      fusion.disagreementHigh ? 'High modality disagreement increased caution.' : 'Modality disagreement stayed within normal range.',
      `Crisis score contribution was ${crisis.score.toFixed(3)}.`,
      `Final distress score ${clamped.toFixed(3)}.`,
    ],
  };
}
