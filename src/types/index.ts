import type { SupportStrategyLabel } from '../routing/strategy_labels';
import type { ResponseStyle } from '../generation/style_profiles';

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
  quality?: FrameQualityAssessment;
}

export type AnalysisVariant = 'text_only' | 'multimodal_ungated' | 'full_engine_quality_gated';

export interface FusionResult {
  dominant: EmotionLabel;
  scores: EmotionScore[];
  confidence: number;
  textWeight: number;
  imageWeight: number;
  disagreementScore: number;
  disagreementHigh: boolean;
  textDominant: EmotionLabel;
  faceDominant?: EmotionLabel;
  rationale: string[];
}

export interface CrisisAssessment {
  level: CrisisLevel;
  score: number;
  flags: string[];
  message: string;
  trustedAdultPrompt: string;
  rationale: string[];
}

export interface DistressAssessment {
  level: 'low' | 'medium' | 'high';
  score: number;
  rationale: string[];
}

export interface SupportReply {
  recognition: string;
  validation: string;
  guidance: string[];
  safetyNote?: string;
}

export interface ReplyCandidateScore {
  source: string;
  score: number;
  style?: ResponseStyle;
  rationale: string[];
}

export interface StrategyRoute {
  label: SupportStrategyLabel;
  confidence: number;
  distressLevel: 'low' | 'medium' | 'high';
  rationale: string[];
}

export interface RuntimeSignal {
  label: string;
  status: 'ready' | 'fallback' | 'unavailable';
  detail: string;
}

export interface SafetyDecision {
  cautiousMode: boolean;
  fallbackTriggered: boolean;
  reason: string;
  rationale: string[];
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

export interface FrameQualityAssessment {
  usable: boolean;
  brightness: number;
  contrast: number;
  sharpness: number;
  reasons: string[];
}

export interface AnalysisBundle {
  text: TextEmotionResult;
  face?: FaceEmotionResult;
  fusion: FusionResult;
  strategy: StrategyRoute;
  crisis: CrisisAssessment;
  distress: DistressAssessment;
  safety: SafetyDecision;
  reply: SupportReply;
  retrievalRationale: string[];
  candidateScores: ReplyCandidateScore[];
  preferredStyle: ResponseStyle;
  runtime: RuntimeSignal[];
}

export interface CounterfactualAnalysis {
  variant: AnalysisVariant;
  title: string;
  summary: string;
  analysis: AnalysisBundle;
}
