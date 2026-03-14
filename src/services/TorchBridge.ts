import { describeBundledModels } from './PretrainedModels';

export interface TorchCapability {
  available: boolean;
  mode: 'placeholder';
  reason: string;
  nextStep: string;
  bundledModelNotes: string[];
}

export const torchCapability: TorchCapability = {
  available: false,
  mode: 'placeholder',
  reason:
    'PyTorch JavaScript bindings are not reliably supported for on-device inference in current Expo-managed React Native apps without custom native work or a backend bridge.',
  nextStep:
    'Swap this module for a native TorchScript bridge, a custom dev client plugin, or a server-backed inference adapter when production model support is chosen.',
  bundledModelNotes: describeBundledModels(),
};

export async function loadTorchModel() {
  return torchCapability;
}
