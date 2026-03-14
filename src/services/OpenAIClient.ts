import OpenAI from 'openai';
import { OPENAI_API_KEY, OPENAI_MODEL } from '../config';

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // required for React Native runtime
});

export const MODEL = OPENAI_MODEL;
