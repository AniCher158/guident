from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


EMOTIONS = ["calm", "sad", "anxious", "overwhelmed", "angry", "lonely", "hopeful", "neutral"]
NEGATIVE_WORDS = {"sad", "hopeless", "pointless", "alone", "overwhelmed", "angry", "mad", "tense", "cry", "guilty", "cope"}
POSITIVE_WORDS = {"better", "proud", "calm", "hopeful", "okay", "got through"}
CRISIS_CUES = ["kill myself", "want to die", "unsafe", "hopeless", "cannot cope", "can't cope", "self harm", "hurt myself"]


@dataclass
class ExperimentCase:
    id: str
    user_text: str
    face_emotion: str
    face_confidence: float
    expected_emotion: str
    expected_strategy: str
    expected_distress: str
    crisis: bool


def load_config(project_root: Path) -> dict[str, Any]:
    config_path = project_root / "configs" / "experiments.yaml"
    return json.loads(config_path.read_text(encoding="utf-8"))


def load_cases(config: dict[str, Any]) -> list[ExperimentCase]:
    return [ExperimentCase(**item) for item in config["cases"]]


def text_emotion_scores(text: str) -> dict[str, float]:
    lowered = text.lower()
    base = {label: 1.0 for label in EMOTIONS}
    weighted = {
        "overwhelmed": ["overwhelmed", "too much", "drama"],
        "anxious": ["nervous", "tense", "waiting", "calm down"],
        "sad": ["sad", "pointless", "hopeless", "guilty"],
        "angry": ["angry", "mad"],
        "lonely": ["alone", "left out"],
        "hopeful": ["better", "proud"],
    }
    for emotion, cues in weighted.items():
        for cue in cues:
            if cue in lowered:
                base[emotion] += 2.2
    if "school" in lowered or "exam" in lowered:
        base["overwhelmed"] += 1.2
    if "friend" in lowered:
        base["lonely"] += 0.8
        base["angry"] += 0.6
    total = sum(base.values())
    return {key: round(value / total, 4) for key, value in base.items()}


def dominant_label(scores: dict[str, float]) -> str:
    return max(scores.items(), key=lambda item: item[1])[0]


def sentiment_label(text: str) -> str:
    lowered = text.lower()
    neg = sum(1 for word in NEGATIVE_WORDS if word in lowered)
    pos = sum(1 for word in POSITIVE_WORDS if word in lowered)
    if neg >= pos + 2:
        return "sad"
    if pos > neg:
        return "hopeful"
    return "neutral"


def detect_crisis(text: str) -> bool:
    lowered = text.lower()
    return any(cue in lowered for cue in CRISIS_CUES)


def distress_level(text: str, crisis: bool) -> str:
    if crisis:
        return "high"
    lowered = text.lower()
    score = sum(1 for word in NEGATIVE_WORDS if word in lowered)
    if score >= 3:
        return "medium"
    return "low"


def fallback_reason(confidence: float, disagreement: float, strategy_confidence: float, distress: str) -> tuple[bool, str]:
    if disagreement >= 0.6:
        return True, "high_modality_disagreement"
    if confidence < 0.26:
        return True, "low_fusion_confidence"
    if strategy_confidence < 0.65:
        return True, "low_strategy_confidence"
    if distress != "low":
        return False, "elevated_distress"
    return False, "normal"


def route_strategy(emotion: str, crisis: bool, distress: str) -> str:
    if crisis or distress == "high":
        return "escalation"
    if distress == "medium" and emotion in {"sad", "neutral"}:
        return "validation"
    if emotion == "lonely":
        return "reflective_listening"
    if emotion in {"anxious", "overwhelmed"}:
        return "grounding"
    if emotion in {"hopeful", "calm"}:
        return "encouragement"
    if emotion == "angry":
        return "coping_suggestion"
    return "validation"


def fuse_emotions(text_scores: dict[str, float], face_emotion: str, face_confidence: float) -> dict[str, Any]:
    sorted_text = sorted(text_scores.items(), key=lambda item: item[1], reverse=True)
    text_margin = sorted_text[0][1] - sorted_text[1][1]
    text_weight = round(1 - min(0.4, max(0.08, face_confidence - text_margin * 0.5) * 0.35), 4)
    image_weight = round(1 - text_weight, 4)

    fused = dict(text_scores)
    for label in EMOTIONS:
        fused[label] = fused.get(label, 0.0) * text_weight
    fused[face_emotion] = round(fused.get(face_emotion, 0.0) + face_confidence * image_weight, 4)
    total = sum(fused.values())
    fused = {key: round(value / total, 4) for key, value in fused.items()}
    text_emotion = dominant_label(text_scores)
    disagreement = 0.0 if text_emotion == face_emotion else round(0.55 + (1 - text_margin) * 0.2 + face_confidence * 0.25, 4)
    confidence = round(max(fused.values()), 4)
    return {
        "fused_scores": fused,
        "fused_emotion": dominant_label(fused),
        "fusion_confidence": confidence,
        "disagreement_score": disagreement,
        "text_weight": text_weight,
        "image_weight": image_weight,
    }


def score_prediction(predicted: str, expected: str) -> float:
    return 1.0 if predicted == expected else 0.0


def response_stub(strategy: str, emotion: str, conditioned: bool) -> str:
    if conditioned:
        return f"strategy={strategy}; emotion={emotion}; style=conditioned"
    return f"strategy={strategy}; style=generic"


def summarize_metrics(rows: list[dict[str, Any]], label_key: str) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(str(row[label_key]), []).append(row)

    summary = []
    for label, items in grouped.items():
        n = len(items)
        summary.append({
            label_key: label,
            "n_cases": n,
            "emotion_accuracy": round(sum(float(item["emotion_match"]) for item in items) / n, 3),
            "strategy_accuracy": round(sum(float(item["strategy_match"]) for item in items) / n, 3),
            "distress_accuracy": round(sum(float(item["distress_match"]) for item in items) / n, 3),
            "crisis_recall": round(sum(float(item["crisis_match"]) for item in items) / n, 3),
        })
    return summary
