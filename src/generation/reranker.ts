import { FusionResult, StrategyRoute, SupportReply } from '../types/index';
import { ResponseStyle } from './style_profiles';

export interface RankedCandidate {
  candidate: SupportReply;
  source: string;
  style?: ResponseStyle;
  score: number;
  rationale: string[];
}

function containsEmotionAlignment(reply: SupportReply, fusion: FusionResult): boolean {
  const haystack = `${reply.recognition} ${reply.validation} ${reply.guidance.join(' ')}`.toLowerCase();
  return haystack.includes(fusion.dominant) || (fusion.dominant === 'overwhelmed' && haystack.includes('next step'));
}

function strategyMatch(reply: SupportReply, strategy: StrategyRoute): boolean {
  const haystack = `${reply.recognition} ${reply.validation} ${reply.guidance.join(' ')}`.toLowerCase();
  if (strategy.label === 'grounding') return haystack.includes('breath') || haystack.includes('exhale') || haystack.includes('step');
  if (strategy.label === 'reflective_listening') return haystack.includes('heaviest part') || haystack.includes('hearing') || haystack.includes('honest');
  if (strategy.label === 'encouragement') return haystack.includes('progress') || haystack.includes('handled') || haystack.includes('repeat');
  if (strategy.label === 'coping_suggestion') return haystack.includes('boundary') || haystack.includes('reply') || haystack.includes('write');
  if (strategy.label === 'validation') return haystack.includes('makes sense') || haystack.includes('understandable');
  return true;
}

function styleMatch(reply: SupportReply, style: ResponseStyle): boolean {
  const haystack = `${reply.recognition} ${reply.validation} ${reply.guidance.join(' ')}`.toLowerCase();
  if (style === 'calm') return haystack.includes('steady') || haystack.includes('slow') || haystack.includes('breath');
  if (style === 'validating') return haystack.includes('makes sense') || haystack.includes('understandable') || haystack.includes('valid');
  if (style === 'reflective') return haystack.includes('hearing') || haystack.includes('sounds like') || haystack.includes('part of this');
  if (style === 'action_oriented') return haystack.includes('next') || haystack.includes('step') || haystack.includes('pick one');
  if (style === 'safety_focused') return haystack.includes('safe') || haystack.includes('trusted adult') || haystack.includes('support');
  return true;
}

export function rerankCandidates(
  candidates: RankedCandidate[],
  fusion: FusionResult,
  strategy: StrategyRoute,
  preferredStyle: ResponseStyle,
): RankedCandidate[] {
  return candidates
    .map((item) => {
      const rationale = [...item.rationale];
      let score = item.score;
      if (containsEmotionAlignment(item.candidate, fusion)) {
        score += 1.2;
        rationale.push('Aligned with fused emotion.');
      }
      if (strategyMatch(item.candidate, strategy)) {
        score += 1;
        rationale.push('Aligned with routed support strategy.');
      }
      if (item.style && item.style === preferredStyle) {
        score += 0.8;
        rationale.push(`Matched preferred style ${preferredStyle}.`);
      } else if (item.style && styleMatch(item.candidate, preferredStyle)) {
        score += 0.4;
        rationale.push(`Text matched preferred style ${preferredStyle}.`);
      }
      if (item.candidate.guidance.length === 2) {
        score += 0.5;
        rationale.push('Returned the expected two-step guidance shape.');
      }
      return { ...item, score: Number(score.toFixed(3)), rationale };
    })
    .sort((a, b) => b.score - a.score);
}
