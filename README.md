# Guident

Guident is a React Native + TypeScript MVP for a teen mental-health support prototype. It offers a safety-first check-in flow with:

- chat-style reflection UI
- optional single-frame selfie capture
- heuristic text emotion analysis
- optional face-emotion analysis abstraction
- multimodal fusion that weights text more than image
- supportive responses structured as recognition -> validation -> guidance
- crisis phrase detection and trusted-adult encouragement
- a privacy/safety disclaimer before use

## Why Expo

I chose **Expo (managed workflow)** because it is the most likely path to work cleanly on this Mac for a polished prototype with TypeScript and camera support.

Why not bare React Native for this MVP?

- Expo camera integration is straightforward with `expo-camera`
- setup friction is lower for iOS simulator / device testing
- the app can be installed and iterated on quickly by another developer
- full on-device PyTorch inference in React Native is not mature enough to justify adding native complexity for this prototype

If the project later needs real on-device model inference, the most realistic next step is moving to a **custom dev client or bare React Native app** with a native model bridge.

## Safety stance

Guident is **not a therapist**, **not a medical device**, and **not for emergencies**.
It does not diagnose. If a user may be in danger, the UI pushes them toward immediate real-world help and encourages contacting a trusted adult or counselor.

## What is real vs placeholder

### Real in this MVP

- React Native chat/check-in UI
- safety disclaimer flow
- optional single-frame camera capture
- text emotion analysis using local heuristic cues
- crisis phrase detection
- multimodal fusion layer with explicit text > image weighting
- supportive response generation with a fixed structure

### Placeholder / abstraction

- face-emotion analysis is currently routed through the `Sensory` service as a stable placeholder
- bundled pretrained assets under `pretrained/` are now explicitly acknowledged by the app architecture, but not directly executed on-device in Expo
- `TorchBridge` is a documented placeholder because PyTorch JS is not reliably supportable in the current Expo-managed mobile setup

## PyTorch JS note

The requirement asked to use PyTorch bindings for JavaScript where practical. In current React Native mobile reality, that is **not practically reliable inside an Expo-managed app** without custom native work or a backend.

So this project does **not pretend unsupported inference works**. Instead it includes:

- `src/services/TorchBridge.ts` — explicit capability/limitation shim
- `src/services/Sensory.ts` — interface ready for replacement with real model inference later

Future implementation options:

1. native TorchScript bridge in bare React Native
2. Expo custom dev client with a dedicated native module
3. backend inference service with strict privacy review

## Architecture

The core JS-side services are named to match the requested mental model:

- **Limbic** — text emotion analysis from user language cues
- **Sensory** — camera/frame intake and optional face-emotion analysis abstraction
- **Prefrontal** — fusion, crisis checks, and supportive response planning

Data flow:

1. user writes a check-in
2. optional camera frame is captured
3. `Limbic` scores text emotion
4. `Sensory` returns a face-emotion result placeholder if a frame exists
5. `Prefrontal` fuses inputs, checks crisis language, and builds a supportive reply
6. UI renders both the response and an analysis card

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

Then open in:

- iOS simulator: `npm run ios`
- Android emulator: `npm run android`
- Web preview: `npm run web`

## Validation used

Recommended local checks:

```bash
npm run typecheck
```

## Limitations

- emotion analysis is heuristic and not clinically validated
- camera emotion output is mocked, not a real model
- no persistence, authentication, or backend
- no localization
- no push-to-care workflow beyond on-screen guidance
- crisis detection uses simple phrase matching and can miss nuance

## Future work

- replace heuristic `Limbic` scoring with a tested lightweight model
- implement a real face model behind `Sensory`
- add journaling history and privacy controls
- add teen-safe escalation UX with configurable local crisis resources
- move to bare RN or custom dev client if native on-device inference becomes a priority
