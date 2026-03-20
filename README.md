# Guident

Guident is a React Native + TypeScript MVP for a teen mental-health support prototype. It offers a safety-first check-in flow with:

- chat-style reflection UI
- optional single-frame selfie capture
- on-device text emotion analysis with DistilBERT plus keyword fallback
- optional on-device face-emotion analysis with FER2013 TFLite plus fallback
- confidence-weighted multimodal fusion with disagreement detection
- local reply generation through `llama.rn` when a sideloaded GGUF model is available
- local reply generation through `llama.rn` when a sideloaded GGUF model is available
- optional backend-routed API reply generation via OpenAI as a fallback when the local proxy server is running
- deterministic crisis detection and trusted-adult encouragement
- a privacy/safety disclaimer before use

## Why Expo

I chose **Expo (managed workflow)** because it is the most likely path to work cleanly on this Mac for a polished prototype with TypeScript and camera support.

Why not fully bare React Native yet?

- Expo camera integration is straightforward with `expo-camera`
- setup friction is lower for iOS simulator / device testing
- the app can be installed and iterated on quickly by another developer
- the app can still use native-backed inference paths through Expo dev builds without committing to a larger migration yet

If the project later needs heavier local models or more direct native control, the next step is a **custom dev client or bare React Native app** with dedicated native model management.

## Safety stance

Guident is **not a therapist**, **not a medical device**, and **not for emergencies**.
It does not diagnose. If a user may be in danger, the UI pushes them toward immediate real-world help and encourages contacting a trusted adult or counselor.

## What is real vs fallback

### Real in this MVP

- React Native chat/check-in UI
- safety disclaimer flow
- optional single-frame camera capture
- on-device DistilBERT text scoring
- on-device FER2013 face scoring
- local Phi-2 style reply generation via `llama.rn` when a GGUF file is present in app documents
- rule-based crisis phrase detection plus explicit distress scoring and uncertainty-aware fallback
- multimodal fusion layer with explicit text > image weighting, fused distributions, and disagreement scoring
- supportive response generation with structured prompts, template retrieval, candidate reranking, and fallback

### Fallback behavior

- if DistilBERT fails to load, `Limbic` falls back to weighted keyword cues
- if FER2013 fails to load, `Sensory` falls back to a mocked low-confidence face signal
- if a local GGUF model is sideloaded and `llama.rn` loads successfully, reply generation uses that first
- if local GGUF generation is unavailable, or the local generation fails, the app falls back to the backend OpenAI path when configured
- if neither local GGUF nor backend generation is available, `Prefrontal` falls back to deterministic support templates
- `TorchBridge` remains a documented placeholder for future PyTorch-native work

## PyTorch JS note

The requirement asked to use PyTorch bindings for JavaScript where practical. In current React Native mobile reality, that is **not practically reliable inside an Expo-managed app** without custom native work or a backend.

So this project does **not pretend unsupported inference works**. Instead it includes:

- `src/services/TorchBridge.ts` — explicit capability/limitation shim
- `src/services/Sensory.ts` — interface ready for replacement with real model inference later

Future implementation options:

1. native TorchScript bridge in bare React Native
2. Expo custom dev client with a dedicated native module
3. backend inference service only if privacy and safety review justify it

## Architecture

The core JS-side services are named to match the requested mental model:

- **Limbic** — text emotion analysis from user language cues
- **Sensory** — camera/frame intake and optional face-emotion analysis abstraction
- **Router** — interpretable support-strategy selection from fused signals
- **Prefrontal** — crisis checks and supportive response planning

Data flow:

1. user writes a check-in
2. optional camera frame is captured
3. `Limbic` scores text emotion
4. `Sensory` scores a face emotion if a frame exists
5. Fusion computes a fused distribution, confidence, and disagreement score
6. Routing selects a support strategy label, confidence, and distress level
7. Retrieval selects strategy-aligned support templates and coping language
8. Safety policy decides whether to use normal generation, cautious fallback, or escalation
9. `Prefrontal` generates candidates, reranks them, and returns the best structured reply when normal generation is allowed
10. UI renders the response, runtime/model status, fusion diagnostics, routing choice, and safety/generation diagnostics

## Folder structure

```text
guident/
├── App.tsx
├── README.md
├── src/
│   ├── components/
│   │   ├── AnalysisCard.tsx
│   │   └── MessageBubble.tsx
│   ├── constants/
│   │   └── copy.ts
│   ├── screens/
│   │   ├── DisclaimerScreen.tsx
│   │   └── GuidentScreen.tsx
│   ├── services/
│   │   ├── guidentEngine.ts
│   │   ├── Limbic.ts
│   │   ├── LocalLLM.ts
│   │   ├── Prefrontal.ts
│   │   ├── Sensory.ts
│   │   └── TorchBridge.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── emotion.ts
└── package.json
```

## Setup

```bash
cd guident
npm install
npm run start
```

To enable backend-routed OpenAI reply generation in Expo, add an `.env` file with:

```bash
OPENAI_API_KEY=your_key_here
EXPO_PUBLIC_OPENAI_MODEL=gpt-4.1-mini
EXPO_PUBLIC_GUIDENT_API_BASE_URL=http://127.0.0.1:8787
GUIDENT_API_PORT=8787
```

Then start the backend:

```bash
npm run api:start
```

And start Expo separately:

```bash
npm run start
```

For the iOS simulator, `http://127.0.0.1:8787` works. For a physical phone, set `EXPO_PUBLIC_GUIDENT_API_BASE_URL` to your Mac's LAN IP, for example `http://192.168.1.25:8787`.

This prototype now sends the prompt and current check-in text to the local backend, and only the backend talks to OpenAI.

Then open in:

- iOS simulator: `npm run ios`
- Android emulator: `npm run android`
- Web preview: `npm run web`

## Validation used

Recommended local checks:

```bash
npm install
npm run typecheck
npm run eval:all
```

Evaluation artifacts are written to `artifacts/evaluation/` and include:

- case-level CSV and JSON outputs for ablations and baselines
- intermediate fusion outputs including weights and disagreement scores in ablation case logs
- summary CSV, JSON, and Markdown tables
- SVG comparison plots for emotion and strategy accuracy

Generation now also logs retrieval rationale and candidate ranking summaries in runtime analysis output.
Safety logic now logs distress level, crisis detections, cautious-mode activation, and fallback-policy decisions.
Phase 6 analysis now adds semantic metrics, emotion-alignment summaries, safety metrics, calibration outputs, and modality disagreement analysis under `artifacts/evaluation/analysis/`.
Phase 7 adds optional controllable response styles: `calm`, `validating`, `reflective`, `action_oriented`, and `safety_focused`.

## Limitations

- emotion analysis is heuristic and not clinically validated
- local LLM quality depends on the sideloaded GGUF model and device memory budget
- no persistence or authentication
- no localization
- no push-to-care workflow beyond on-screen guidance
- crisis detection is still rule-based and can miss nuance

## Future work

- replace heuristic `Limbic` scoring with a tested lightweight model
- improve distress and suicide-risk classifiers with a safer evaluation set
- add journaling history and privacy controls
- add teen-safe escalation UX with configurable local crisis resources
- harden `llama.rn` loading, streaming, and model packaging for production
