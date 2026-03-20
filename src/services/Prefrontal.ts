import {
  CrisisAssessment,
  DistressAssessment,
  FaceEmotionResult,
  FusionResult,
  ReplyCandidateScore,
  StrategyRoute,
  SupportReply,
  TextEmotionResult,
} from '../types/index';
import { confidenceWeightedFusion } from '../fusion/confidence_weighted_fusion';
import { generateSupportReply } from '../generation/prefrontal_generate';
import { SupportStrategyLabel } from '../routing/strategy_labels';
import { assessDistressIntensity } from '../emotion/distress_intensity';
import { detectCrisis } from '../safety/crisis_detector';
import { buildEscalationReply } from '../safety/escalation_logic';
import { evaluateFallbackPolicy } from '../safety/fallback_policy';

function topSecondaryEmotion(scores: TextEmotionResult['scores'], dominant: FusionResult['dominant']): FusionResult['dominant'] | undefined {
  const secondary = scores.find((item) => item.label !== dominant);
  if (!secondary) return undefined;
  return secondary.score >= 0.16 ? secondary.label : undefined;
}

function detectTopic(userText: string): string | undefined {
  const lowered = userText.toLowerCase();
  if (lowered.includes('left out') || lowered.includes('alone') || lowered.includes('texted') || lowered.includes('friend')) return 'feeling shut out socially';
  if (lowered.includes('parents') && lowered.includes('fighting')) return 'being stuck around conflict at home';
  if (lowered.includes('school') || lowered.includes('class') || lowered.includes('exam') || lowered.includes('practice')) return 'school and performance pressure';
  if (lowered.includes('angry') || lowered.includes('mad') || lowered.includes('regret') || lowered.includes('text back')) return 'anger that feels close to spilling over';
  if (lowered.includes('coach') || lowered.includes('counselor') || lowered.includes('better now') || lowered.includes('calmer now') || lowered.includes('relieved')) return 'a shift after getting some support';
  if (lowered.includes('crying earlier') || lowered.includes('was crying')) return 'the aftermath of an earlier hard moment';
  if (lowered.includes('hopeless') || lowered.includes('pointless')) return 'everything feeling bleak and hard to carry';
  return undefined;
}

function emotionPhrase(dominant: FusionResult['dominant'], secondary?: FusionResult['dominant']): string {
  if (secondary && secondary !== dominant) {
    if (dominant === 'sad' && secondary === 'lonely') return 'hurt and pretty alone';
    if (dominant === 'anxious' && secondary === 'overwhelmed') return 'on edge and overloaded';
    if (dominant === 'hopeful' && secondary === 'anxious') return 'a little steadier, even with nerves still there';
    if (dominant === 'calm' && secondary === 'hopeful') return 'more settled, with some real relief underneath it';
    return `${dominant}, with some ${secondary} mixed in`;
  }
  switch (dominant) {
    case 'overwhelmed':
      return 'really overloaded';
    case 'anxious':
      return 'on edge';
    case 'lonely':
      return 'alone in it';
    case 'hopeful':
      return 'a bit more hopeful';
    default:
      return dominant;
  }
}

function recognitionFromUserText(userText: string, dominant: FusionResult['dominant'], secondary?: FusionResult['dominant']): string {
  const topic = detectTopic(userText);
  const feeling = emotionPhrase(dominant, secondary);
  if (topic) {
    return `It sounds like ${topic} is leaving you feeling ${feeling}.`;
  }
  return `It sounds like this is leaving you feeling ${feeling}.`;
}

function validationForContext(strategy: SupportStrategyLabel, dominant: FusionResult['dominant'], userText: string): string {
  const lowered = userText.toLowerCase();
  if (lowered.includes('left out') || lowered.includes('alone') || lowered.includes('no one texted')) {
    return 'Feeling shut out or unimportant can hit hard, especially when it keeps repeating.';
  }
  if (lowered.includes('parents') && lowered.includes('fighting')) {
    return 'Living around conflict can keep your body braced even when you are trying to get through normal things.';
  }
  if (lowered.includes('practice') || lowered.includes('exam') || lowered.includes('class')) {
    return 'School and performance pressure can stay in your head long after the moment is over.';
  }
  if (lowered.includes('angry') || lowered.includes('mad') || lowered.includes('regret')) {
    return 'That kind of anger usually means something important feels crossed, exposed, or unfair.';
  }
  if (strategy === 'encouragement' && (dominant === 'hopeful' || dominant === 'calm')) {
    return 'A steadier moment is still real progress, even if another part of you does not fully trust it yet.';
  }
  if (strategy === 'grounding') {
    return 'When your system is overloaded, narrowing the next few minutes is often more useful than trying to solve everything at once.';
  }
  if (strategy === 'reflective_listening') {
    return 'It makes sense that this would feel heavy before you are ready to problem-solve it.';
  }
  return 'What you are feeling fits the situation you described, even if it is messy or mixed.';
}

function guidanceForContext(strategy: SupportStrategyLabel, dominant: FusionResult['dominant'], userText: string): string[] | undefined {
  const lowered = userText.toLowerCase();
  if (strategy === 'reflective_listening' && (lowered.includes('left out') || lowered.includes('texted'))) {
    return ['Name the part that hurt most: being ignored, being unsure, or feeling replaceable.', 'Send one honest message to a safe person instead of waiting until you can phrase it perfectly.'];
  }
  if (strategy === 'grounding' && lowered.includes('parents') && lowered.includes('fighting')) {
    return ['Focus on the next 10 minutes only, not the whole pattern at home.', 'Do one physical reset like unclenching your jaw or pressing both feet into the floor for 30 seconds.'];
  }
  if (strategy === 'encouragement' && (lowered.includes('coach') || lowered.includes('counselor') || lowered.includes('cousin'))) {
    return ['Notice what helped this interaction go better than it might have a week ago.', 'Keep the support loop open by sending one short follow-up instead of disappearing again.'];
  }
  if (strategy === 'coping_suggestion' && (dominant === 'angry' || lowered.includes('text back'))) {
    return ['Delay the response long enough to write the uncensored version somewhere private first.', 'Decide whether you want the next message to set a boundary, ask for repair, or simply pause the conversation.'];
  }
  return undefined;
}

function strategyGuidance(strategy: SupportStrategyLabel, dominant: FusionResult['dominant']): string[] {
  switch (strategy) {
    case 'grounding':
      return ['Shrink the problem to the next 10-minute step only.', 'Do one slow exhale longer than your inhale for 60 seconds.'];
    case 'reflective_listening':
      return ['Name the heaviest part of this out loud or in writing without trying to fix it yet.', 'If there is one safe person, send them one honest sentence about what today feels like.'];
    case 'encouragement':
      return ['Name one thing you handled better than you would have a month ago.', 'Pick one small repeatable action that can protect this progress.'];
    case 'coping_suggestion':
      return ['Pause before replying and write the uncensored version in notes first.', 'Ask what boundary, expectation, or hurt is underneath the anger.'];
    case 'escalation':
      return ['Get near a trusted adult or another safe person now.', 'Call or text 988 now if you are in the U.S. or Canada, or contact local emergency support.'];
    default:
      if (dominant === 'sad' || dominant === 'lonely') {
        return ['Pick one small action that usually helps a little, even if motivation is low.', 'Text one safe person a concrete message about what today feels like.'];
      }
      return ['Notice the strongest thought in your head and label it as a thought, not a fact.', 'Pick one small action for the next hour that would make today 5% easier.'];
  }
}

function buildTemplateReply(userText: string, text: TextEmotionResult, fusion: FusionResult, strategy: StrategyRoute): SupportReply {
  const recognitionPrefix: Record<SupportStrategyLabel, string> = {
    validation: 'It sounds like',
    reflective_listening: 'I am hearing that',
    encouragement: 'It sounds like',
    coping_suggestion: 'It sounds like',
    grounding: 'It sounds like',
    escalation: 'What you wrote sounds like',
  };
  const secondary = topSecondaryEmotion(text.scores, fusion.dominant);
  const contextualGuidance = guidanceForContext(strategy.label, fusion.dominant, userText);

  return {
    recognition: fusion.dominant === 'neutral'
      ? `${recognitionPrefix[strategy.label]} a lot is sitting in the background right now.`
      : recognitionFromUserText(userText, fusion.dominant, secondary),
    validation: validationForContext(strategy.label, fusion.dominant, userText),
    guidance: contextualGuidance ?? strategyGuidance(strategy.label, fusion.dominant),
  };
}

export class PrefrontalService {
  assessCrisis(input: string): CrisisAssessment {
    return detectCrisis(input);
  }

  assessDistress(input: string, text: TextEmotionResult, fusion: FusionResult, crisis: CrisisAssessment): DistressAssessment {
    return assessDistressIntensity(input, text, fusion, crisis);
  }

  fuse(text: TextEmotionResult, face?: FaceEmotionResult): FusionResult {
    return confidenceWeightedFusion(text, face);
  }

  async buildReply(
    text: TextEmotionResult,
    face: FaceEmotionResult | undefined,
    fusion: FusionResult,
    strategy: StrategyRoute,
    crisis: CrisisAssessment,
    distress: DistressAssessment,
    userText: string,
  ): Promise<{ reply: SupportReply; retrievalRationale: string[]; candidateScores: ReplyCandidateScore[]; preferredStyle: import('../generation/style_profiles').ResponseStyle; safety: { cautiousMode: boolean; fallbackTriggered: boolean; reason: string; rationale: string[] } }> {
    const fallback = buildTemplateReply(userText, text, fusion, strategy);
    const safety = evaluateFallbackPolicy(fusion, strategy, distress);

    if (crisis.level === 'high') {
      return {
        reply: buildEscalationReply(crisis, distress.level),
        retrievalRationale: ['Skipped retrieval because crisis escalation overrides normal support generation.'],
        candidateScores: [{ source: 'crisis-escalation', score: 1, rationale: ['Crisis path bypassed candidate generation.'] }],
        preferredStyle: 'safety_focused',
        safety,
      };
    }

    if (crisis.level === 'medium' || distress.level === 'high') {
      return {
        reply: buildEscalationReply(crisis, distress.level),
        retrievalRationale: ['Skipped retrieval because elevated distress uses the safer direct-support path.'],
        candidateScores: [{ source: 'elevated-distress-escalation', score: 1, rationale: ['Elevated distress path bypassed candidate generation.'] }],
        preferredStyle: 'safety_focused',
        safety,
      };
    }

    if (safety.fallbackTriggered) {
      return {
        reply: {
          ...fallback,
          validation: `${fallback.validation} I want to stay careful with the parts that still look mixed or uncertain.`,
          guidance: strategy.label === 'grounding'
            ? ['Focus only on the next few minutes, not the whole situation.', 'Try one slow breath cycle and then decide on one safe next step.']
            : fallback.guidance,
        },
        retrievalRationale: [`Skipped retrieval because fallback policy activated: ${safety.reason}.`],
        candidateScores: [{ source: 'uncertainty-fallback', style: 'safety_focused', score: 1, rationale: ['Uncertainty-aware fallback replaced candidate generation.'] }],
        preferredStyle: 'safety_focused',
        safety,
      };
    }

    const generated = await generateSupportReply({ userText, text, face, fusion, strategy, crisis, safety, fallback });

    return {
      reply: generated.reply,
      retrievalRationale: generated.retrievalRationale,
      candidateScores: generated.candidateReranking.map((item) => ({
        source: item.source,
        score: item.score,
        style: item.style,
        rationale: item.rationale,
      })),
      preferredStyle: generated.preferredStyle,
      safety,
    };
  }
}

export const Prefrontal = new PrefrontalService();
