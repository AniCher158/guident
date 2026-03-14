import { CRISIS_COPY, TRUSTED_ADULT_COPY } from '../constants/copy';
import {
  CrisisAssessment,
  FaceEmotionResult,
  FusionResult,
  SupportReply,
  TextEmotionResult,
} from '../types';
import { openai, MODEL } from './OpenAIClient';

// ── Few-shot examples sampled from train_mixed.jsonl (counsel-chat, empathy) ─
// Each assistant turn matches the JSON schema we request, teaching tone + format.
const FEW_SHOT: { role: 'user' | 'assistant'; content: string }[] = [
  {
    role: 'user',
    content: "I start counseling in a few days and I'm freaking out. My biggest fear is that I'll cry and embarrass myself.",
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      recognition: "It sounds like you're feeling really nervous about opening up, and that makes complete sense.",
      validation: "Crying in therapy is actually a sign that you're letting yourself feel — it's completely normal and nothing to be embarrassed about.",
      guidance: [
        "Notice the thought 'I'll embarrass myself' — ask yourself: what's the evidence for and against that?",
        "You don't have to share everything at once — going at your own pace is a skill, not a weakness.",
      ],
    }),
  },
  {
    role: 'user',
    content: "I feel like every time I do something someone asks me to, I never fully meet what they want. They always think they should have picked someone else.",
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      recognition: "It sounds like you're exhausted from trying to measure up to what everyone else wants from you.",
      validation: "Feeling like you never quite measure up often says more about impossible standards than about your actual worth.",
      guidance: [
        "That thought — 'they wish they picked someone else' — is mind-reading. What actually happened vs. what you assumed?",
        "Write down one thing you completed today and read it back as if a friend told you they did it.",
      ],
    }),
  },
  {
    role: 'user',
    content: "I'm obsessing about a terrible breakup. Everything is a constant reminder. How do I move on?",
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      recognition: "It sounds like this breakup is taking up so much space in your mind, and everything around you is keeping the pain alive.",
      validation: "Grieving a relationship takes time, and the obsessive thoughts are your heart trying to process a real loss.",
      guidance: [
        "Notice if you're catastrophising ('I'll never feel okay again') — feelings are temporary, not facts.",
        "Schedule one small activity today that you used to enjoy, even if motivation is low — action comes before feeling.",
      ],
    }),
  },
  {
    role: 'user',
    content: "Every winter I find myself getting sad because of the weather. How can I fight this?",
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      recognition: "It sounds like the darker months genuinely drain your mood every year, and that's a real pattern worth taking seriously.",
      validation: "Seasonal shifts in mood are incredibly common, and recognizing the pattern is already an important first step.",
      guidance: [
        "Track your mood against daylight and activity for a few days — patterns reveal what's actually driving the dip.",
        "Schedule one small outdoor or social activity this week as a behavioural experiment — notice how you feel after.",
      ],
    }),
  },
  {
    role: 'user',
    content: "I feel like I hate myself physically and emotionally sometimes. How can I start accepting myself?",
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      recognition: "It sounds like you're carrying a really heavy weight of self-criticism right now.",
      validation: "Struggling with self-acceptance is incredibly human — it doesn't mean something is fundamentally wrong with you.",
      guidance: [
        "Notice the self-critical thought and ask: would I say this to a friend? If not, what would I say instead?",
        "Write down one small piece of evidence that contradicts the belief that you're not good enough.",
      ],
    }),
  },
  {
    role: 'user',
    content: "I'm being overworked and it's giving me anxiety. It feels demoralizing. What can I do to manage my stress?",
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      recognition: "It sounds like you're running on empty, giving a lot and not feeling like it's being recognized.",
      validation: "Feeling demoralized when your effort isn't matched by respect or care is a completely understandable response.",
      guidance: [
        "Notice if you're using all-or-nothing thinking ('I can never say no') — what's a more balanced version of that thought?",
        "Pick the single most important task today and do only that — behavioural overload fuels anxiety.",
      ],
    }),
  },
];

const crisisLexicon = ['suicide', 'kill myself', 'hurt myself', 'self harm', 'want to disappear', 'end it'];

export class PrefrontalService {
  assessCrisis(input: string): CrisisAssessment {
    const lowered = input.toLowerCase();
    const flags = crisisLexicon.filter((cue) => lowered.includes(cue));

    if (flags.length > 0) {
      return { level: 'high', flags, message: CRISIS_COPY, trustedAdultPrompt: TRUSTED_ADULT_COPY };
    }
    if (/(can't cope|unsafe|hopeless|no reason to live)/i.test(input)) {
      return {
        level: 'medium',
        flags: ['elevated distress'],
        message: 'This sounds serious. Please reach out to a trusted adult or counselor now.',
        trustedAdultPrompt: TRUSTED_ADULT_COPY,
      };
    }
    return {
      level: 'low',
      flags: [],
      message: 'No explicit crisis phrases detected.',
      trustedAdultPrompt: TRUSTED_ADULT_COPY,
    };
  }

  fuse(text: TextEmotionResult, face?: FaceEmotionResult): FusionResult {
    const textWeight = face ? 0.75 : 1;
    const imageWeight = face ? 0.25 : 0;
    const confidence = Math.min(0.95, 0.45 + text.scores[0].score * textWeight + (face?.confidence ?? 0) * imageWeight);
    const dominant = textWeight >= imageWeight ? text.dominant : face?.dominant ?? text.dominant;

    return {
      dominant,
      confidence: Number(confidence.toFixed(3)),
      textWeight,
      imageWeight,
      rationale: [
        `Text weighted at ${Math.round(textWeight * 100)}%.`,
        face ? `Image contributed ${Math.round(imageWeight * 100)}%.` : 'No image signal.',
      ],
    };
  }

  async buildReply(fusion: FusionResult, crisis: CrisisAssessment, userText: string): Promise<SupportReply> {
    try {
      const resp = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              `You are Guident, a warm and empathetic mental health support assistant for teenagers. ` +
              `The user is feeling ${fusion.dominant}. ` +
              `Use a Cognitive Behavioral Therapy (CBT) approach: help the user notice unhelpful thought patterns, ` +
              `gently challenge distorted thinking (e.g. catastrophising, all-or-nothing thinking, mind-reading), ` +
              `and suggest small behavioral experiments or reframes they can try right now. ` +
              `Respond with a JSON object containing:\n` +
              `- "recognition": 1 sentence acknowledging how they feel\n` +
              `- "validation": 1 sentence normalising their emotion\n` +
              `- "guidance": array of 2 short CBT-informed coping tips (e.g. thought records, reframes, or behavioural activation)\n` +
              `Be warm, concise, and teen-appropriate. Return only valid JSON, no markdown.`,
          },
          ...FEW_SHOT,
          { role: 'user', content: userText },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 300,
      });

      const parsed = JSON.parse(resp.choices[0].message.content!);
      const reply: SupportReply = {
        recognition: parsed.recognition ?? '',
        validation: parsed.validation ?? '',
        guidance: parsed.guidance ?? [],
      };
      if (crisis.level !== 'low') {
        reply.safetyNote = `${crisis.message} ${crisis.trustedAdultPrompt}`;
      }
      return reply;
    } catch (e) {
      console.warn('[Prefrontal] OpenAI call failed:', e);
      return {
        recognition: 'It sounds like you are going through a lot right now.',
        validation: 'What you are feeling is valid and understandable.',
        guidance: ['Take a slow breath.', 'Reach out to someone you trust.'],
        ...(crisis.level !== 'low' && { safetyNote: `${crisis.message} ${crisis.trustedAdultPrompt}` }),
      };
    }
  }
}

export const Prefrontal = new PrefrontalService();
