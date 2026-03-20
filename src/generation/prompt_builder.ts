import { CrisisAssessment, FusionResult, StrategyRoute, SupportReply, TextEmotionResult, FaceEmotionResult, SafetyDecision } from '../types/index';
import { ResponseStyle, styleInstruction } from './style_profiles';
import { RetrievedContext } from '../retrieval/retrieve_context';
import { FewShotExample, selectFewShotExamples } from './few_shot_examples';

export interface PromptContext {
  userText: string;
  text: TextEmotionResult;
  face?: FaceEmotionResult;
  fusion: FusionResult;
  strategy: StrategyRoute;
  crisis: CrisisAssessment;
  safety: SafetyDecision;
  retrieved: RetrievedContext;
  fallback: SupportReply;
  responseStyle: ResponseStyle;
  fewShotExamples?: FewShotExample[];
}

export function buildStructuredPrompt(context: PromptContext): string {
  const retrievedLines = context.retrieved.templates
    .map((template, index) => [
      `Template ${index + 1}:`,
      `strategy=${template.strategy}`,
      `validation=${template.validation}`,
      `guidance=${template.guidance.join(' | ')}`,
    ].join('\n'))
    .join('\n');
  const examples = context.fewShotExamples ?? selectFewShotExamples(context.strategy.label, context.fusion.dominant, context.userText);
  const exampleLines = examples
    .map((example, index) => [
      `Example ${index + 1} user=${JSON.stringify(example.userMessage)}`,
      `Example ${index + 1} assistant=${example.assistantJson}`,
    ].join('\n'))
    .join('\n');

  return [
    'You are Guident, a supportive reflection assistant for teenagers.',
    'Return JSON only with keys recognition, validation, guidance, followUp.',
    'recognition: one sentence.',
    'validation: one sentence.',
    'guidance: array of exactly 2 short coping steps.',
    'followUp: one short optional question.',
    `user_message=${JSON.stringify(context.userText)}`,
    `text_emotion=${context.text.dominant}`,
    `face_emotion=${context.face?.dominant ?? 'none'}`,
    `fused_emotion=${context.fusion.dominant}`,
    `fusion_confidence=${context.fusion.confidence}`,
    `disagreement_score=${context.fusion.disagreementScore}`,
    `support_strategy=${context.strategy.label}`,
    `strategy_confidence=${context.strategy.confidence}`,
    `distress_level=${context.strategy.distressLevel}`,
    `crisis_level=${context.crisis.level}`,
    `response_style=${context.responseStyle}`,
    styleInstruction(context.responseStyle),
    'Use at least one concrete detail from the user message.',
    'Do not repeat stock phrases across sections.',
    'If the user describes mixed feelings or a shift over time, reflect that nuance explicitly.',
    'Match the shape and specificity of the examples, but do not copy them.',
    exampleLines,
    'Use the retrieved support material when useful, but stay concise and natural.',
    retrievedLines,
    `fallback_validation=${context.fallback.validation}`,
    `fallback_guidance=${context.fallback.guidance.join(' | ')}`,
    'Do not mention diagnosis, policy, or being a therapist.',
  ].join('\n');
}
