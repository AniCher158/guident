import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { CapturedFrame, FaceEmotionResult } from '../types';
import { ModelLoader } from './ModelLoader';

// FER2013 label order (standard): angry, disgust, fear, happy, neutral, sad, surprise
const FER_LABELS = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise'] as const;
type FerLabel = (typeof FER_LABELS)[number];

// Map FER2013 labels to the app's emotion space
const FER_TO_APP: Record<FerLabel, FaceEmotionResult['dominant']> = {
  angry:    'angry',
  disgust:  'angry',
  fear:     'anxious',
  happy:    'hopeful',
  neutral:  'neutral',
  sad:      'sad',
  surprise: 'overwhelmed',
};

const INPUT_SIZE = 48;

async function preprocessImage(uri: string): Promise<Float32Array> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: INPUT_SIZE, height: INPUT_SIZE } }],
    { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 1.0 }
  );

  const b64 = resized.base64!;
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const { data: rgba } = jpeg.decode(raw, { useTArray: true });

  // RGBA → grayscale, normalize to [-1, 1]  (standard for FER2013)
  const float = new Float32Array(INPUT_SIZE * INPUT_SIZE);
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    float[i] = gray / 127.5 - 1.0;
  }
  return float;
}

function softmax(arr: Float32Array | number[]): number[] {
  const max = Math.max(...arr);
  const exps = Array.from(arr).map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

// ── mock fallback (used when model unavailable) ────────────────────────────
const mockCycle = [
  { dominant: 'calm' as const, confidence: 0.38 },
  { dominant: 'anxious' as const, confidence: 0.42 },
  { dominant: 'sad' as const, confidence: 0.40 },
  { dominant: 'hopeful' as const, confidence: 0.36 },
];

export class SensoryService {
  async analyzeFace(frame?: CapturedFrame): Promise<FaceEmotionResult | undefined> {
    if (!frame) return undefined;

    const model = ModelLoader.fer2013;
    if (!model) {
      const pick = mockCycle[frame.uri.length % mockCycle.length];
      return {
        dominant: pick.dominant,
        confidence: pick.confidence,
        source: 'mock-fallback',
        rationale: ['FER2013 TFLite unavailable — using mock cycle. Run scripts/convert_models.py first.'],
      };
    }

    try {
      const pixels = await preprocessImage(frame.uri);
      // Shape: [1, 48, 48, 1]
      const outputs = await model.run([pixels]);
      const logits = outputs[0] as Float32Array;
      const probs = softmax(logits);

      const maxIdx = probs.indexOf(Math.max(...probs));
      const ferLabel = FER_LABELS[maxIdx];
      const dominant = FER_TO_APP[ferLabel];
      const confidence = Number(probs[maxIdx].toFixed(3));

      return {
        dominant,
        confidence,
        source: 'fer2013-tflite',
        rationale: [
          `FER2013 CNN: ${FER_LABELS.map((l, i) => `${l} ${(probs[i] * 100).toFixed(1)}%`).join(', ')}`,
          `Mapped "${ferLabel}" → "${dominant}"`,
        ],
      };
    } catch (e) {
      console.warn('[Sensory] FER2013 inference failed:', e);
      const pick = mockCycle[frame.uri.length % mockCycle.length];
      return {
        dominant: pick.dominant,
        confidence: pick.confidence,
        source: 'mock-fallback',
        rationale: [`FER2013 inference error: ${String(e)}`],
      };
    }
  }
}

export const Sensory = new SensoryService();
