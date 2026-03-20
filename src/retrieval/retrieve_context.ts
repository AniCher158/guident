import { FusionResult, StrategyRoute } from '../types/index';
import { TEMPLATE_BANK, TemplateEntry } from './template_bank';

export interface RetrievedContext {
  templates: TemplateEntry[];
  rationale: string[];
}

export function retrieveContext(strategy: StrategyRoute, fusion: FusionResult, userText = ''): RetrievedContext {
  const lowered = userText.toLowerCase();
  const scored = TEMPLATE_BANK.map((entry) => {
    let score = 0;
    if (entry.strategy === strategy.label) score += 3;
    if (entry.emotions.includes(fusion.dominant)) score += 2;
    if (entry.emotions.includes(fusion.textDominant)) score += 1;
    if (entry.tags.some((tag) => lowered.includes(tag))) score += 1.5;
    return { entry, score };
  }).sort((a, b) => b.score - a.score);

  const templates = scored.slice(0, 2).map((item) => item.entry);
  return {
    templates,
    rationale: templates.map((entry) => `Retrieved ${entry.id} for strategy ${entry.strategy} and emotion ${fusion.dominant}.`),
  };
}
