import { EmotionLabel, SupportReply } from '../types/index';

const allowedEmotions = new Set<EmotionLabel>([
  'calm',
  'sad',
  'anxious',
  'overwhelmed',
  'angry',
  'lonely',
  'hopeful',
  'neutral',
]);

export interface ParsedSupportPayload {
  emotion?: EmotionLabel;
  recognition?: string;
  validation?: string;
  guidance?: string[];
  followUp?: string;
  raw: string;
}

export function parsePhiStyleOutput(raw: string): ParsedSupportPayload {
  const trimmed = raw.trim();

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const emotion = typeof parsed.emotion === 'string' && allowedEmotions.has(parsed.emotion as EmotionLabel)
      ? (parsed.emotion as EmotionLabel)
      : undefined;
    const guidance = Array.isArray(parsed.guidance)
      ? parsed.guidance.filter((item): item is string => typeof item === 'string')
      : undefined;

    return {
      emotion,
      recognition: typeof parsed.recognition === 'string' ? parsed.recognition : undefined,
      validation: typeof parsed.validation === 'string' ? parsed.validation : undefined,
      guidance,
      followUp: typeof parsed.followUp === 'string' ? parsed.followUp : undefined,
      raw,
    };
  } catch {
    const lines = trimmed
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const payload: ParsedSupportPayload = { raw };

    for (const line of lines) {
      const normalized = line.replace(/^[-*]\s*/, '');
      const [key, ...rest] = normalized.split(':');
      if (!rest.length) continue;
      const value = rest.join(':').trim();
      const lowerKey = key.toLowerCase().trim();

      if (lowerKey === 'emotion' && allowedEmotions.has(value as EmotionLabel)) payload.emotion = value as EmotionLabel;
      if (lowerKey === 'recognition') payload.recognition = value;
      if (lowerKey === 'validation') payload.validation = value;
      if (lowerKey === 'guidance') payload.guidance = value.split(/\s*\|\s*/).filter(Boolean);
      if (lowerKey === 'followup' || lowerKey === 'follow-up') payload.followUp = value;
    }

    return payload;
  }
}

export function mergeParsedReply(base: SupportReply, parsed?: ParsedSupportPayload): SupportReply {
  if (!parsed) return base;

  return {
    ...base,
    recognition: parsed.recognition ?? base.recognition,
    validation: parsed.validation ?? base.validation,
    guidance: parsed.guidance?.length ? parsed.guidance : base.guidance,
  };
}
