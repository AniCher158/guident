import { buildStructuredPrompt, PromptContext } from './prompt_builder';
import { rerankCandidates, RankedCandidate } from './reranker';
import { retrieveContext } from '../retrieval/retrieve_context';
import { LocalLLM } from '../services/LocalLLM';
import { RemoteLLM } from '../services/RemoteLLM';
import { mergeParsedReply, parsePhiStyleOutput } from '../services/ModelOutputParser';
import { SupportReply } from '../types/index';
import { preferredStyle, RESPONSE_STYLES, ResponseStyle } from './style_profiles';
import { selectFewShotExamples } from './few_shot_examples';

export interface GenerationResult {
  reply: SupportReply;
  retrievalRationale: string[];
  candidateReranking: RankedCandidate[];
}

function buildRetrievedCandidate(context: PromptContext): SupportReply {
  const template = context.retrieved.templates[0];
  if (!template) return context.fallback;
  return {
    recognition: context.fallback.recognition,
    validation: template.validation,
    guidance: template.guidance.slice(0, 2),
  };
}

function applyStyleToFallback(base: SupportReply, style: ResponseStyle): SupportReply {
  if (style === 'validating') {
    return { ...base, validation: `What you are feeling is understandable. ${base.validation}` };
  }
  if (style === 'reflective') {
    return { ...base, recognition: `I am hearing that ${base.recognition.charAt(0).toLowerCase()}${base.recognition.slice(1)}` };
  }
  if (style === 'action_oriented') {
    return { ...base, guidance: base.guidance.map((step) => `Next step: ${step}`) };
  }
  if (style === 'safety_focused') {
    return { ...base, validation: `I want to keep this careful and safe. ${base.validation}` };
  }
  return base;
}

export async function generateSupportReply(context: Omit<PromptContext, 'retrieved' | 'responseStyle'>): Promise<GenerationResult & { preferredStyle: ResponseStyle }> {
  const retrieved = retrieveContext(context.strategy, context.fusion, context.userText);
  const bestStyle = preferredStyle(context.strategy, context.safety);
  const fewShotExamples = selectFewShotExamples(context.strategy.label, context.fusion.dominant, context.userText);
  const remoteStatus = RemoteLLM.getStatus();
  const stylePrompts: Array<{ style: ResponseStyle; prompt: string }> = RESPONSE_STYLES.map((style) => ({
    style,
    prompt: buildStructuredPrompt({ ...context, retrieved, responseStyle: style, fewShotExamples }),
  }));

  const templateCandidate = buildRetrievedCandidate({ ...context, retrieved, responseStyle: bestStyle, fewShotExamples });
  const llmCandidates = await Promise.all(
    stylePrompts.map(async ({ style, prompt }) => {
      const local = await LocalLLM.generateStructured(prompt, context.fallback);
      const remote = !local.usedModel && remoteStatus.status === 'ready'
        ? await RemoteLLM.generateStructured(prompt, context.fallback)
        : { reply: context.fallback, rawText: '', usedModel: false, source: 'remote-skipped' };
      const generated = local.usedModel ? local : remote;
      const parsed = parsePhiStyleOutput(generated.rawText);
      const isBackendOpenAI = generated.source.startsWith('backend-openai:');
      const modelSource = isBackendOpenAI
        ? `Structured remote LLM generation with style ${style}.`
        : generated.usedModel
          ? `Structured local LLM generation with style ${style}.`
          : `Structured generation unavailable; merged fallback used for style ${style}.`;
      return {
        candidate: mergeParsedReply(applyStyleToFallback(context.fallback, style), parsed),
        source: generated.source,
        style,
        score: generated.usedModel ? (isBackendOpenAI ? 1.7 : 1.4) : 0.7,
        rationale: [modelSource],
      };
    }),
  );

  const ranked = rerankCandidates(
    [
      { candidate: templateCandidate, source: 'retrieval-template', style: bestStyle, score: 1.2, rationale: ['Built from retrieved support template bank.'] },
      { candidate: applyStyleToFallback(context.fallback, bestStyle), source: 'deterministic-fallback', style: bestStyle, score: 1.0, rationale: ['Built from local deterministic fallback.'] },
      ...llmCandidates,
    ],
    context.fusion,
    context.strategy,
    bestStyle,
  );

  return {
    reply: ranked[0]?.candidate ?? context.fallback,
    retrievalRationale: retrieved.rationale,
    candidateReranking: ranked,
    preferredStyle: bestStyle,
  };
}
