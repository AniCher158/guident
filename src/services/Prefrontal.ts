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
        "Remind yourself before the session that your therapist has heard this before and won't judge you.",
        "You don't have to share everything at once — go at whatever pace feels right for you.",
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
        "Try setting one small goal for yourself today — not for anyone else.",
        "Notice something you did well this week and give yourself credit before checking if others approve.",
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
        "Give yourself permission to feel sad instead of trying to push the feelings away.",
        "Try creating one small new routine that's just yours — it can help rebuild your sense of self.",
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
        "Try to get outside for even 10 minutes of natural daylight each day — it helps regulate your body clock.",
        "Add one small comforting routine to your winter days, like a walk, a playlist, or a warm drink you enjoy.",
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
        "Try speaking to yourself today the way you would speak to a good friend who felt this way.",
        "Notice one small thing you appreciate about yourself — it doesn't have to be big.",
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
        "Shrink your focus to just the next 10 minutes when everything feels too big.",
        "Talk to one person you trust about what you're going through — even saying it out loud can help.",
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
              `Respond with a JSON object containing:\n` +
              `- "recognition": 1 sentence acknowledging how they feel\n` +
              `- "validation": 1 sentence normalising their emotion\n` +
              `- "guidance": array of 2 short, practical coping tips\n` +
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
