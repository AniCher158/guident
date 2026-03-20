import { SafetyDecision, StrategyRoute } from '../types/index';

export const RESPONSE_STYLES = [
  'calm',
  'validating',
  'reflective',
  'action_oriented',
  'safety_focused',
] as const;

export type ResponseStyle = (typeof RESPONSE_STYLES)[number];

export function preferredStyle(strategy: StrategyRoute, safety: SafetyDecision): ResponseStyle {
  if (safety.cautiousMode) return 'safety_focused';
  if (strategy.label === 'reflective_listening') return 'reflective';
  if (strategy.label === 'grounding' || strategy.label === 'coping_suggestion') return 'action_oriented';
  if (strategy.label === 'validation') return 'validating';
  return 'calm';
}

export function styleInstruction(style: ResponseStyle): string {
  switch (style) {
    case 'calm':
      return 'Tone: calm, steady, and low-intensity.';
    case 'validating':
      return 'Tone: validating first, gentle, and emotionally affirming.';
    case 'reflective':
      return 'Tone: reflective, listening-first, and slightly exploratory.';
    case 'action_oriented':
      return 'Tone: practical, concrete, and behaviorally focused.';
    case 'safety_focused':
      return 'Tone: cautious, supportive, and safety-forward.';
  }
}
