import { Limbic } from './Limbic';
import { LocalLLM } from './LocalLLM';
import { Prefrontal } from './Prefrontal';
import { routeSupportStrategy } from '../routing/strategy_router';
import { RemoteLLM } from './RemoteLLM';
import { Sensory } from './Sensory';
import { AnalysisBundle, AnalysisVariant, CapturedFrame, CounterfactualAnalysis, FaceEmotionResult } from '../types/index';
import { ModelLoader } from './ModelLoader';

async function buildAnalysisFromSignals(
  input: string,
  text: Awaited<ReturnType<typeof Limbic.analyzeText>>,
  frame?: CapturedFrame,
  face?: FaceEmotionResult,
): Promise<AnalysisBundle> {
  const fusion = Prefrontal.fuse(text, face);
  const crisis = Prefrontal.assessCrisis(input);
  const distress = Prefrontal.assessDistress(input, text, fusion, crisis);
  const strategy = routeSupportStrategy(text, face, fusion, crisis, distress);
  const generated = await Prefrontal.buildReply(text, face, fusion, strategy, crisis, distress, input);
  const remoteLLMStatus = RemoteLLM.getStatus();
  const localLLMStatus = LocalLLM.getStatus();
  const llmStatus = localLLMStatus.status === 'ready' ? localLLMStatus : remoteLLMStatus.status === 'ready' ? remoteLLMStatus : localLLMStatus;
  const modelStatus = ModelLoader.status;

  return {
    text,
    face,
    fusion,
    strategy,
    crisis,
    distress,
    safety: generated.safety,
    reply: generated.reply,
    retrievalRationale: generated.retrievalRationale,
    candidateScores: generated.candidateScores,
    preferredStyle: generated.preferredStyle,
    runtime: [
      {
        label: 'Text model',
        status: modelStatus.distilbert === 'ready' ? 'ready' : 'fallback',
        detail: modelStatus.distilbert === 'ready' ? 'DistilBERT ONNX on device.' : 'Keyword fallback in use.',
      },
      {
        label: 'Face model',
        status: face?.source === 'fer2013-tflite' || face?.source === 'fer2013-tflite-ungated' ? 'ready' : face ? 'fallback' : 'unavailable',
        detail: face?.source === 'fer2013-tflite' || face?.source === 'fer2013-tflite-ungated'
          ? 'FER2013 TFLite on device.'
          : face?.source === 'quality-gated'
            ? `Face signal suppressed because image quality was too low${face.quality?.reasons.length ? `: ${face.quality.reasons.join(', ')}` : '.'}`
            : frame
              ? (face?.rationale[0] ?? 'Fallback in use.')
              : 'No camera frame included.',
      },
      {
        label: 'Reply model',
        status: llmStatus.status,
        detail: llmStatus.detail,
      },
    ],
  };
}

export async function analyzeCheckIn(input: string, frame?: CapturedFrame): Promise<AnalysisBundle> {
  const [text, face] = await Promise.all([
    Limbic.analyzeText(input),
    Sensory.analyzeFace(frame),
  ]);

  return buildAnalysisFromSignals(input, text, frame, face);
}

function variantSummary(variant: AnalysisVariant, analysis: AnalysisBundle): string {
  switch (variant) {
    case 'text_only':
      return 'Text only. Face cues are removed so the judge can inspect the language-only route.';
    case 'multimodal_ungated':
      return analysis.face?.quality?.usable === false
        ? 'Ungated counterfactual. The face signal is still used even though frame quality is poor.'
        : 'Ungated multimodal route. The face signal is allowed to influence fusion directly.';
    default:
      return analysis.face?.source === 'quality-gated'
        ? 'Quality-gated route. The face signal was suppressed because the frame looked unreliable.'
        : 'Quality-gated route. The face signal passed the reliability gate.';
  }
}

export async function analyzeCounterfactuals(input: string, frame?: CapturedFrame): Promise<CounterfactualAnalysis[]> {
  const text = await Limbic.analyzeText(input);
  const [gatedFace, ungatedFace] = await Promise.all([
    Sensory.analyzeFace(frame),
    Sensory.analyzeFace(frame, { skipQualityGate: true }),
  ]);

  const variants: Array<{ variant: AnalysisVariant; title: string; face?: FaceEmotionResult }> = [
    { variant: 'text_only', title: 'Text only', face: undefined },
    { variant: 'multimodal_ungated', title: 'Ungated multimodal', face: ungatedFace },
    { variant: 'full_engine_quality_gated', title: 'Quality gated', face: gatedFace },
  ];

  return Promise.all(
    variants.map(async ({ variant, title, face: candidateFace }) => {
      const analysis = await buildAnalysisFromSignals(input, text, frame, candidateFace);
      return {
        variant,
        title,
        summary: variantSummary(variant, analysis),
        analysis,
      };
    }),
  );
}
