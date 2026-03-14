export type EmotionLabel =
  | 'calm'
  | 'sad'
  | 'anxious'
  | 'overwhelmed'
  | 'angry'
  | 'lonely'
  | 'hopeful'
  | 'neutral';

export type CrisisLevel = 'low' | 'medium' | 'high';

export interface EmotionScore {
  label: EmotionLabel;
  score: number;
}

export interface TextEmotionResult {
  dominant: EmotionLabel;
  scores: EmotionScore[];
  rationale: string[];
}

export interface FaceEmotionResult {
  dominant: EmotionLabel;
  confidence: number;
  source: string;
  rationale: string[];
}

export interface FusionResult {
  dominant: EmotionLabel;
  confidence: number;
  textWeight: number;
  imageWeight: number;
  rationale: string[];
}

export interface CrisisAssessment {
  level: CrisisLevel;
  flags: string[];
  message: string;
  trustedAdultPrompt: string;
}

export interface SupportReply {
  recognition: string;
  validation: string;
  guidance: string[];
  safetyNote?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: string;
  emotion?: EmotionLabel;
}

export interface CapturedFrame {
  uri: string;
  capturedAt: string;
}

export interface AnalysisBundle {
  text: TextEmotionResult;
  face?: FaceEmotionResult;
  fusion: FusionResult;
  crisis: CrisisAssessment;
  reply: SupportReply;
}
