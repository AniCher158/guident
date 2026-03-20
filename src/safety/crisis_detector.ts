import { CrisisAssessment } from '../types/index';
import { CRISIS_COPY, TRUSTED_ADULT_COPY } from '../constants/copy';

const HIGH_RISK_PATTERNS: Array<{ pattern: RegExp; score: number; label: string }> = [
  { pattern: /\bkill myself\b/i, score: 0.75, label: 'kill myself' },
  { pattern: /\bend my life\b/i, score: 0.72, label: 'end my life' },
  { pattern: /\bwant to die\b/i, score: 0.72, label: 'want to die' },
  { pattern: /\bdon'?t want to live\b/i, score: 0.74, label: "don't want to live" },
  { pattern: /\bsuicid(?:e|al)\b/i, score: 0.82, label: 'suicidal language' },
  { pattern: /\boverdose\b/i, score: 0.8, label: 'overdose' },
  { pattern: /\bself[- ]?harm\b/i, score: 0.76, label: 'self-harm' },
  { pattern: /\bcut myself\b/i, score: 0.8, label: 'cut myself' },
  { pattern: /\bhurt myself\b/i, score: 0.72, label: 'hurt myself' },
];

const MEDIUM_RISK_PATTERNS: Array<{ pattern: RegExp; score: number; label: string }> = [
  { pattern: /\bunsafe\b/i, score: 0.38, label: 'unsafe' },
  { pattern: /\bhopeless\b/i, score: 0.28, label: 'hopeless' },
  { pattern: /\bno reason to live\b/i, score: 0.55, label: 'no reason to live' },
  { pattern: /\bcan'?t cope\b/i, score: 0.3, label: "can't cope" },
  { pattern: /\bcan'?t do this\b/i, score: 0.26, label: "can't do this" },
  { pattern: /\bwant to disappear\b/i, score: 0.3, label: 'want to disappear' },
  { pattern: /\beveryone would be better off without me\b/i, score: 0.52, label: 'burdensome thinking' },
  { pattern: /\bnothing matters\b/i, score: 0.24, label: 'nothing matters' },
];

const PROTECTIVE_PATTERNS: Array<{ pattern: RegExp; score: number; label: string }> = [
  { pattern: /\bi am safe\b/i, score: -0.12, label: 'explicitly says they are safe' },
  { pattern: /\bnot going to hurt myself\b/i, score: -0.18, label: 'explicit denial of self-harm intent' },
  { pattern: /\btrying to stay safe\b/i, score: -0.1, label: 'staying safe' },
];

export function detectCrisis(input: string): CrisisAssessment {
  const rationale: string[] = [];
  const flags = HIGH_RISK_PATTERNS.filter(({ pattern }) => pattern.test(input)).map(({ label, score }) => {
    rationale.push(`High-risk cue matched: ${label} (+${score.toFixed(2)}).`);
    return label;
  });
  const elevated = MEDIUM_RISK_PATTERNS.filter(({ pattern }) => pattern.test(input)).map(({ label, score }) => {
    rationale.push(`Elevated-risk cue matched: ${label} (+${score.toFixed(2)}).`);
    return label;
  });
  const lowered = input.toLowerCase();
  const protective = PROTECTIVE_PATTERNS.filter(({ pattern }) => pattern.test(input));

  let score = 0.02;
  for (const item of HIGH_RISK_PATTERNS) {
    if (item.pattern.test(input)) score += item.score;
  }
  for (const item of MEDIUM_RISK_PATTERNS) {
    if (item.pattern.test(input)) score += item.score;
  }
  for (const item of protective) {
    score += item.score;
    rationale.push(`Protective phrase detected: ${item.label} (${item.score.toFixed(2)}).`);
  }
  if (/\btonight\b/i.test(input) || /\bright now\b/i.test(input)) {
    score += 0.08;
    rationale.push('Immediate-time language increased urgency (+0.08).');
  }
  if (/\bplan\b/i.test(lowered) || /\bhow to\b/i.test(lowered) || /\bmethod\b/i.test(lowered)) {
    score += 0.16;
    rationale.push('Possible planning language increased urgency (+0.16).');
  }

  const normalized = Number(Math.max(0, Math.min(0.99, score)).toFixed(3));
  if (flags.length > 0 || normalized >= 0.72) {
    return {
      level: 'high',
      score: normalized,
      flags: [...flags, ...elevated],
      message: CRISIS_COPY,
      trustedAdultPrompt: TRUSTED_ADULT_COPY,
      rationale,
    };
  }

  if (elevated.length > 0 || normalized >= 0.3) {
    return {
      level: 'medium',
      score: normalized,
      flags: elevated,
      message: 'This sounds serious and too heavy to hold alone right now. Please reach out to a trusted adult, counselor, or crisis support now.',
      trustedAdultPrompt: TRUSTED_ADULT_COPY,
      rationale,
    };
  }

  return {
    level: 'low',
    score: normalized,
    flags: [],
    message: 'No explicit crisis phrases detected.',
    trustedAdultPrompt: TRUSTED_ADULT_COPY,
    rationale: rationale.length > 0 ? rationale : ['No crisis cues matched.'],
  };
}
