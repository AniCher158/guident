import { EmotionLabel } from '../types/index';
import { SupportStrategyLabel } from '../routing/strategy_labels';

export interface TemplateEntry {
  id: string;
  strategy: SupportStrategyLabel;
  emotions: EmotionLabel[];
  validation: string;
  guidance: string[];
  tags: string[];
}

export const TEMPLATE_BANK: TemplateEntry[] = [
  {
    id: 'grounding-overwhelm-1',
    strategy: 'grounding',
    emotions: ['overwhelmed', 'anxious'],
    validation: 'When everything feels loud at once, slowing the next step down is a reasonable response.',
    guidance: ['Reduce the problem to the next 10-minute step only.', 'Loosen your jaw and extend each exhale a little longer than each inhale.'],
    tags: ['grounding', 'breathing', 'overwhelm', 'school', 'parents', 'fighting', 'practice'],
  },
  {
    id: 'reflective-lonely-1',
    strategy: 'reflective_listening',
    emotions: ['lonely', 'sad'],
    validation: 'Feeling pushed to the edge of a group can hurt more than people around you realize.',
    guidance: ['Write the hardest sentence first without fixing it.', 'Send one direct message to a safe person instead of waiting for the perfect words.'],
    tags: ['lonely', 'connection', 'left out', 'texted', 'ignored', 'friend'],
  },
  {
    id: 'encouragement-hopeful-1',
    strategy: 'encouragement',
    emotions: ['hopeful', 'calm'],
    validation: 'A steadier moment counts, even if part of you expects it not to last.',
    guidance: ['Name one thing that helped this go a little better.', 'Repeat one small action that supports this momentum.'],
    tags: ['encouragement', 'progress', 'coach', 'counselor', 'relieved', 'better', 'handled'],
  },
  {
    id: 'coping-anger-1',
    strategy: 'coping_suggestion',
    emotions: ['angry', 'overwhelmed'],
    validation: 'Anger often shows up when something important feels crossed, ignored, or unfair.',
    guidance: ['Write the raw response privately before sending anything.', 'Ask what boundary or hurt the anger is protecting.'],
    tags: ['anger', 'coping', 'boundary', 'reply', 'regret', 'text back'],
  },
  {
    id: 'validation-sad-1',
    strategy: 'validation',
    emotions: ['sad', 'neutral', 'lonely'],
    validation: 'This reaction makes sense given what has been landing on you.',
    guidance: ['Pick one small action that usually helps a little.', 'Let one safe person know today feels heavier than usual.'],
    tags: ['validation', 'sadness', 'ashamed', 'stupid', 'numb', 'crying'],
  },
  {
    id: 'escalation-high-1',
    strategy: 'escalation',
    emotions: ['sad', 'anxious', 'overwhelmed', 'angry', 'lonely', 'neutral', 'calm', 'hopeful'],
    validation: 'This sounds too intense to hold alone right now.',
    guidance: ['Get near a trusted adult or another safe person now.', 'Call or text 988 now if you are in the U.S. or Canada, or contact local emergency support.'],
    tags: ['safety', 'escalation'],
  },
];
