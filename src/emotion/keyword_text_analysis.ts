import { TextEmotionResult } from '../types/index';
import { normalizeScores, topEmotion } from '../utils/emotion';

const weightedLexicon: Record<string, Partial<Record<TextEmotionResult['dominant'], number>>> = {
  anxious: { anxious: 2.4 }, anxiety: { anxious: 2.4 }, nervous: { anxious: 2.2 },
  panic: { overwhelmed: 2.8, anxious: 1.8 }, stressed: { overwhelmed: 2.4 },
  drowning: { overwhelmed: 2.7 }, exhausted: { overwhelmed: 2.2, sad: 1.1 },
  angry: { angry: 2.5 }, mad: { angry: 2.1 }, irritated: { angry: 1.8 },
  sad: { sad: 2.5 }, down: { sad: 2 }, empty: { sad: 2.3, lonely: 1.5 },
  lonely: { lonely: 2.8 }, alone: { lonely: 2.4 }, invisible: { lonely: 2.1 },
  calm: { calm: 2.2 }, okay: { calm: 1.2, neutral: 1.4 },
  hopeful: { hopeful: 2.4 }, better: { hopeful: 1.8 }, proud: { hopeful: 1.9, calm: 0.9 },
  confused: { overwhelmed: 1.7, anxious: 1.1 }, scared: { anxious: 2.3, overwhelmed: 1.4 },
  cry: { sad: 2.2 }, crying: { sad: 2.5 }, worthless: { sad: 2.8 },
  ashamed: { sad: 2.1, anxious: 1.2 }, school: { overwhelmed: 0.8 },
  exam: { anxious: 1.5 }, friend: { lonely: 0.7, hopeful: 0.4 },
  parents: { overwhelmed: 0.8, anxious: 0.4 }, trapped: { overwhelmed: 2.2, anxious: 1.1 },
  numb: { sad: 1.8, neutral: 0.8 }, unsafe: { anxious: 1.7, overwhelmed: 1.4 },
  hopeless: { sad: 2.5, lonely: 1.4 }, pointless: { sad: 2.4 },
  guilty: { sad: 1.6, angry: 0.8 },
  relieved: { calm: 2.2, hopeful: 1.4 },
  relief: { calm: 2.1, hopeful: 1.2 },
  calmer: { calm: 2.2, hopeful: 0.7 },
  progress: { hopeful: 1.8 },
  boundary: { angry: 0.8, hopeful: 1.4 },
  left: { lonely: 0.5 },
  out: { lonely: 0.3 },
  ignored: { lonely: 1.3, angry: 0.7 },
  rejected: { lonely: 1.6, sad: 0.9 },
  stupid: { sad: 1.6, anxious: 0.9 },
};

const phraseWeights: Array<{ pattern: RegExp; rationale: string; apply: (base: Record<TextEmotionResult['dominant'], number>) => void }> = [
  {
    pattern: /\bleft out\b/i,
    rationale: 'Social exclusion phrase detected.',
    apply: (base) => {
      base.lonely += 2.8;
      base.sad += 0.8;
    },
  },
  {
    pattern: /\bno one texted me back\b|\bnobody texted me back\b/i,
    rationale: 'Unanswered-text phrase detected.',
    apply: (base) => {
      base.lonely += 2.6;
      base.sad += 0.7;
    },
  },
  {
    pattern: /\bfeel better now\b|\bbetter now\b|\bcalmer now\b|\bfeel calm now\b/i,
    rationale: 'Recovery phrase detected.',
    apply: (base) => {
      base.calm += 2.4;
      base.hopeful += 1.1;
      base.sad = Math.max(0.4, base.sad - 0.5);
      base.overwhelmed = Math.max(0.4, base.overwhelmed - 0.35);
    },
  },
  {
    pattern: /\bproud of\b|\bhandled .* better\b|\bgot through\b/i,
    rationale: 'Progress phrase detected.',
    apply: (base) => {
      base.hopeful += 2.4;
      base.calm += 0.9;
    },
  },
  {
    pattern: /\bdo not know how to calm down\b|\bdon't know how to calm down\b/i,
    rationale: 'Explicit inability-to-calm phrase detected.',
    apply: (base) => {
      base.overwhelmed += 2.1;
      base.anxious += 1.1;
    },
  },
  {
    pattern: /\bmy parents keep fighting\b/i,
    rationale: 'Family conflict phrase detected.',
    apply: (base) => {
      base.anxious += 1.9;
      base.overwhelmed += 1.2;
    },
  },
  {
    pattern: /\bpractice better than i expected\b|\bbetter than i expected\b/i,
    rationale: 'Positive surprise phrase detected.',
    apply: (base) => {
      base.hopeful += 2;
      base.anxious += 0.4;
    },
  },
  {
    pattern: /\bfeel stupid and ashamed\b/i,
    rationale: 'Shame phrase detected.',
    apply: (base) => {
      base.sad += 2.2;
      base.anxious += 0.8;
    },
  },
  {
    pattern: /\bwant to disappear\b/i,
    rationale: 'Disappearance phrase detected.',
    apply: (base) => {
      base.sad += 1.9;
      base.overwhelmed += 1;
    },
  },
];

export function analyzeTextKeywords(input: string): TextEmotionResult {
  const base = { calm: 1, sad: 1, anxious: 1, overwhelmed: 1, angry: 1, lonely: 1, hopeful: 1, neutral: 1.2 };
  const rationale: string[] = ['Keyword analysis path active.'];
  const lowered = input.toLowerCase();
  const tokens = lowered.replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const entry = weightedLexicon[token as keyof typeof weightedLexicon];
    if (!entry) continue;
    rationale.push(`Matched cue: "${token}"`);
    for (const [emotion, weight] of Object.entries(entry)) {
      base[emotion as keyof typeof base] += weight ?? 0;
    }
  }

  for (const phrase of phraseWeights) {
    if (!phrase.pattern.test(input)) continue;
    phrase.apply(base);
    rationale.push(phrase.rationale);
  }

  if (input.includes('!')) {
    base.overwhelmed += 0.6;
    rationale.push('Exclamation detected.');
  }
  if (input.length > 180) {
    base.overwhelmed += 0.4;
    rationale.push('Long message detected.');
  }
  if (/(always|every day|constantly|all the time)/i.test(input)) {
    base.overwhelmed += 0.4;
    base.sad += 0.2;
    rationale.push('Persistent-stress language detected.');
  }
  if (/(maybe|kind of|sort of|i guess|not sure)/i.test(lowered)) {
    base.neutral += 0.3;
    rationale.push('Uncertain language slightly reduced emotional certainty.');
  }
  if (/\bbut\b|\balthough\b|\beven though\b/i.test(lowered) && /\bnow\b|\bactually\b|\bhonestly\b/i.test(lowered)) {
    base.calm += 0.7;
    base.hopeful += 0.5;
    rationale.push('Contrastive recovery language nudged the model toward current-state emotion.');
  }

  const scores = normalizeScores(base);
  return {
    dominant: topEmotion(scores),
    scores,
    rationale,
  };
}
