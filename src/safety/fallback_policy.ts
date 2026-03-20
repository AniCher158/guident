import { DistressAssessment, FusionResult, StrategyRoute } from '../types/index';

export interface FallbackPolicyResult {
  cautiousMode: boolean;
  fallbackTriggered: boolean;
  reason: string;
  rationale: string[];
}

export function evaluateFallbackPolicy(
  fusion: FusionResult,
  strategy: StrategyRoute,
  distress: DistressAssessment,
): FallbackPolicyResult {
  const lowConfidence = fusion.confidence < 0.26;
  const highDisagreement = fusion.disagreementHigh || fusion.disagreementScore >= 0.6;
  const elevatedDistress = distress.level !== 'low';
  const routerUncertain = strategy.confidence < 0.65;
  const fallbackTriggered = lowConfidence || highDisagreement || routerUncertain;
  const cautiousMode = fallbackTriggered || elevatedDistress;

  let reason = 'normal';
  if (highDisagreement) reason = 'high_modality_disagreement';
  else if (lowConfidence) reason = 'low_fusion_confidence';
  else if (routerUncertain) reason = 'low_strategy_confidence';
  else if (elevatedDistress) reason = 'elevated_distress';

  return {
    cautiousMode,
    fallbackTriggered,
    reason,
    rationale: [
      `Fusion confidence ${fusion.confidence.toFixed(3)}.`,
      `Disagreement score ${fusion.disagreementScore.toFixed(3)}.`,
      `Strategy confidence ${strategy.confidence.toFixed(3)}.`,
      `Distress level ${distress.level}.`,
    ],
  };
}
