export interface BundledModelInfo {
  id: string;
  family: 'distilbert' | 'tensorflow-savedmodel' | 'phi2-bundle';
  path: string;
  status: 'bundled' | 'requires-native-loader' | 'requires-backend';
  notes: string;
}

export const bundledModels: BundledModelInfo[] = [
  {
    id: 'distilbert-empathy',
    family: 'distilbert',
    path: 'pretrained/distilbert_empathy_model',
    status: 'requires-backend',
    notes:
      'Bundled Hugging Face assets detected. In Expo-managed React Native, safetensors + tokenizer inference is better handled via a backend or custom native/JS runtime bridge.',
  },
  {
    id: 'fer2013-cnn',
    family: 'tensorflow-savedmodel',
    path: 'pretrained/fer2013_cnn_savedmodel',
    status: 'requires-native-loader',
    notes:
      'Bundled TensorFlow SavedModel detected. Expo camera capture can feed this later, but loading SavedModel directly on-device requires a different runtime or native bridge.',
  },
  {
    id: 'phi2-export-bundle',
    family: 'phi2-bundle',
    path: 'pretrained/model/phi2_export_bundle.tar',
    status: 'requires-native-loader',
    notes:
      'Bundled Phi-2 export detected. The current app cannot execute this archive directly, but downstream code can parse structured text output from a future Phi-2 backend/native runner.',
  },
];

export function describeBundledModels(): string[] {
  return bundledModels.map((model) => `${model.id}: ${model.notes}`);
}
