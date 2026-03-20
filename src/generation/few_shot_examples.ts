import { EmotionLabel } from '../types/index';
import { SupportStrategyLabel } from '../routing/strategy_labels';

export interface FewShotExample {
  id: string;
  strategy: SupportStrategyLabel;
  emotions: EmotionLabel[];
  tags: string[];
  userMessage: string;
  assistantJson: string;
}

const EXAMPLES: FewShotExample[] = [
  {
    id: 'social-lonely-reflective',
    strategy: 'reflective_listening',
    emotions: ['lonely', 'sad'],
    tags: ['left out', 'text', 'ignored', 'friend'],
    userMessage: 'No one texted me back after lunch and now I feel left out and kind of stupid for caring this much.',
    assistantJson: JSON.stringify({
      recognition: 'It sounds like being left hanging after lunch has you feeling lonely and embarrassed at the same time.',
      validation: 'Getting no response can hit like rejection, especially when you were already hoping to feel included.',
      guidance: [
        'Name the part that hurt most: being ignored, feeling replaceable, or not knowing what people meant.',
        'Send one honest sentence to a safe person instead of waiting until you can say it perfectly.',
      ],
      followUp: 'What part of that felt heaviest?'
    }),
  },
  {
    id: 'overwhelmed-grounding',
    strategy: 'grounding',
    emotions: ['overwhelmed', 'anxious'],
    tags: ['school', 'drama', 'parents', 'fighting'],
    userMessage: 'School drama and my parents fighting at home have me so keyed up that I do not know how to calm down.',
    assistantJson: JSON.stringify({
      recognition: 'It sounds like stress at school and stress at home are piling up into one overloaded feeling.',
      validation: 'When your system has been bracing for conflict, it makes sense that calming down does not happen on command.',
      guidance: [
        'Shrink the problem to the next ten minutes instead of the whole week.',
        'Do one slow exhale longer than your inhale and keep both feet pressed into the floor.',
      ],
      followUp: 'What feels most urgent in the next hour?'
    }),
  },
  {
    id: 'anger-coping',
    strategy: 'coping_suggestion',
    emotions: ['angry', 'overwhelmed'],
    tags: ['angry', 'text back', 'boundary', 'regret'],
    userMessage: 'I am angry enough to text back something cruel, but I know I will regret it if I do.',
    assistantJson: JSON.stringify({
      recognition: 'It sounds like you are angry and close to reacting before you have decided what you actually want to say.',
      validation: 'That kind of anger usually means something important feels crossed, exposed, or unfair.',
      guidance: [
        'Write the raw version privately first so the feeling has somewhere to go.',
        'Decide whether your next move is a boundary, a pause, or a repair attempt before you send anything.',
      ],
      followUp: 'What feels crossed here?'
    }),
  },
  {
    id: 'recovery-encouragement',
    strategy: 'encouragement',
    emotions: ['calm', 'hopeful'],
    tags: ['better now', 'coach', 'counselor', 'relieved'],
    userMessage: 'I was a mess earlier, but after talking to my coach I feel calmer and kind of relieved now.',
    assistantJson: JSON.stringify({
      recognition: 'It sounds like earlier was rough, but talking to your coach helped you feel calmer and more steady now.',
      validation: 'A steadier moment still counts, even when part of you expects the stress to come back.',
      guidance: [
        'Notice what specifically helped that conversation shift your state.',
        'Keep the momentum by doing one small repeatable thing that supports this calmer version of you.',
      ],
      followUp: 'What helped most in that conversation?'
    }),
  },
];

export function selectFewShotExamples(
  strategy: SupportStrategyLabel,
  dominant: EmotionLabel,
  userText: string,
  limit = 2,
): FewShotExample[] {
  const lowered = userText.toLowerCase();
  return EXAMPLES
    .map((example) => {
      let score = 0;
      if (example.strategy === strategy) score += 3;
      if (example.emotions.includes(dominant)) score += 2;
      if (example.tags.some((tag) => lowered.includes(tag))) score += 1.5;
      return { example, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.example);
}
