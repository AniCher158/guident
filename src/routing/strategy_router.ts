import { CrisisAssessment, DistressAssessment, FaceEmotionResult, FusionResult, TextEmotionResult } from '../types/index';
import { SupportStrategyLabel } from './strategy_labels';

export interface StrategyRoute {
  label: SupportStrategyLabel;
  confidence: number;
  distressLevel: 'low' | 'medium' | 'high';
  rationale: string[];
}

export function routeSupportStrategy(
  text: TextEmotionResult,
  face: FaceEmotionResult | undefined,
  fusion: FusionResult,
  crisis: CrisisAssessment,
  distress: DistressAssessment,
): StrategyRoute {
  const distressLevel = distress.level;

  if (crisis.level !== 'low') {
    return {
      label: 'escalation',
      confidence: 0.99,
      distressLevel,
      rationale: ['Crisis assessment is elevated, so escalation overrides all other strategies.'],
    };
  }

  if (fusion.disagreementHigh) {
    return {
      label: 'reflective_listening',
      confidence: 0.64,
      distressLevel,
      rationale: [
        `High modality disagreement (${fusion.disagreementScore.toFixed(3)}) suggests a cautious listening-first response.`,
        face ? `Text=${text.dominant}, face=${face.dominant}.` : 'No face modality available.',
      ],
    };
  }

  if (fusion.dominant === 'overwhelmed' || fusion.dominant === 'anxious') {
    return {
      label: 'grounding',
      confidence: Number(Math.min(0.94, 0.62 + fusion.confidence * 0.4).toFixed(3)),
      distressLevel,
      rationale: [`Dominant fused emotion is ${fusion.dominant}, so grounding is the best first move.`],
    };
  }

  if (fusion.dominant === 'lonely') {
    return {
      label: 'reflective_listening',
      confidence: Number(Math.min(0.9, 0.6 + fusion.confidence * 0.35).toFixed(3)),
      distressLevel,
      rationale: ['Loneliness benefits from reflective listening before problem-solving.'],
    };
  }

  if (fusion.dominant === 'hopeful' || fusion.dominant === 'calm') {
    return {
      label: 'encouragement',
      confidence: Number(Math.min(0.9, 0.58 + fusion.confidence * 0.35).toFixed(3)),
      distressLevel,
      rationale: [`Dominant fused emotion is ${fusion.dominant}, which supports an encouragement strategy.`],
    };
  }

  if (fusion.dominant === 'angry') {
    return {
      label: 'coping_suggestion',
      confidence: Number(Math.min(0.9, 0.58 + fusion.confidence * 0.35).toFixed(3)),
      distressLevel,
      rationale: ['Anger benefits from a coping-oriented response that slows reaction down.'],
    };
  }

  return {
    label: 'validation',
    confidence: Number(Math.min(0.88, 0.55 + fusion.confidence * 0.3).toFixed(3)),
    distressLevel,
    rationale: ['Defaulting to validation because the fused state does not strongly call for a narrower strategy.'],
  };
}
