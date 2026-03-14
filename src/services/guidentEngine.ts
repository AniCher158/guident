import { Limbic } from './Limbic';
import { Prefrontal } from './Prefrontal';
import { Sensory } from './Sensory';
import { AnalysisBundle, CapturedFrame } from '../types';

export async function analyzeCheckIn(input: string, frame?: CapturedFrame): Promise<AnalysisBundle> {
  const [text, face] = await Promise.all([
    Limbic.analyzeText(input),
    Sensory.analyzeFace(frame),
  ]);

  const fusion = Prefrontal.fuse(text, face);
  const crisis = Prefrontal.assessCrisis(input);
  const reply = await Prefrontal.buildReply(fusion, crisis, input);

  return { text, face, fusion, crisis, reply };
}
