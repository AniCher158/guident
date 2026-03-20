import { CrisisAssessment, DistressAssessment, SupportReply } from '../types/index';

export function buildEscalationReply(crisis: CrisisAssessment, level: DistressAssessment['level']): SupportReply {
  if (crisis.level === 'high') {
    return {
      recognition: 'What you wrote sounds urgent and safety comes first right now.',
      validation: 'You do not need to carry this alone in this moment.',
      guidance: [
        'Put the phone down and get near a trusted adult or another safe person now.',
        'Call or text 988 now if you are in the U.S. or Canada, or contact local emergency support.',
      ],
      safetyNote: `${crisis.message} ${crisis.trustedAdultPrompt}`,
    };
  }

  return {
    recognition: 'What you wrote sounds heavy enough that getting another person involved now would help.',
    validation: 'Reaching out for immediate support is a strong move, not an overreaction.',
    guidance: [
      'Tell one trusted adult exactly what is happening right now.',
      'Do not stay isolated with this tonight; get another person involved.',
    ],
    ...(level !== 'low' && { safetyNote: `${crisis.message} ${crisis.trustedAdultPrompt}` }),
  };
}
