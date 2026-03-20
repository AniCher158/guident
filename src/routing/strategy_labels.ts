export const SUPPORT_STRATEGIES = [
  'validation',
  'reflective_listening',
  'encouragement',
  'coping_suggestion',
  'grounding',
  'escalation',
] as const;

export type SupportStrategyLabel = (typeof SUPPORT_STRATEGIES)[number];
