/**
 * ModelLoader — initializes on-device models once and exposes them.
 * Call `ModelLoader.init()` early in App.tsx.
 */
import { Asset } from 'expo-asset';
import { InferenceSession } from 'onnxruntime-react-native';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { loadVocab } from './Tokenizer';

export type ModelStatus = 'pending' | 'ready' | 'unavailable';

interface ModelState {
  distilbert: InferenceSession | null;
  fer2013: TensorflowModel | null;
  status: {
    distilbert: ModelStatus;
    fer2013: ModelStatus;
  };
}

const state: ModelState = {
  distilbert: null,
  fer2013: null,
  status: { distilbert: 'pending', fer2013: 'pending' },
};

async function loadDistilBERT() {
  try {
    await loadVocab();
    const asset = Asset.fromModule(require('../../assets/models/distilbert_empathy.onnx'));
    const res = await fetch(asset.uri);
    if (!res.ok) throw new Error(`Asset fetch failed: HTTP ${res.status} — ${asset.uri}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    state.distilbert = await InferenceSession.create(bytes);
    state.status.distilbert = 'ready';
    console.log('[ModelLoader] DistilBERT ready');
  } catch (e) {
    state.status.distilbert = 'unavailable';
    console.warn('[ModelLoader] DistilBERT unavailable:', e);
  }
}

async function loadFER2013() {
  try {
    const model = await loadTensorflowModel(
      require('../../assets/models/fer2013.tflite'),
      'core-ml',
    );
    state.fer2013 = model;
    state.status.fer2013 = 'ready';
    console.log('[ModelLoader] FER2013 ready');
  } catch (e) {
    try {
      const model = await loadTensorflowModel(require('../../assets/models/fer2013.tflite'));
      state.fer2013 = model;
      state.status.fer2013 = 'ready';
      console.log('[ModelLoader] FER2013 ready (CPU fallback)');
    } catch (e2) {
      state.status.fer2013 = 'unavailable';
      console.warn('[ModelLoader] FER2013 unavailable:', e2);
    }
  }
}

let initPromise: Promise<void> | null = null;

export const ModelLoader = {
  init(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = Promise.all([loadDistilBERT(), loadFER2013()]).then(() => {});
    return initPromise;
  },
  get distilbert() { return state.distilbert; },
  get fer2013() { return state.fer2013; },
  get status() { return { ...state.status }; },
};
