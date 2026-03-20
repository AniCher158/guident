from __future__ import annotations

from pathlib import Path

from evaluation.reporting import write_bar_chart_svg, write_csv, write_json, write_markdown_table
from experiments.common import (
    detect_crisis,
    distress_level,
    fallback_reason,
    fuse_emotions,
    load_cases,
    load_config,
    response_stub,
    route_strategy,
    score_prediction,
    summarize_metrics,
    text_emotion_scores,
    dominant_label,
)


def run_ablation(config: dict, output_dir: Path) -> None:
    cases = load_cases(config)
    rows = []

    for experiment in config["ablations"]:
        for case in cases:
            crisis = detect_crisis(case.user_text)
            distress = distress_level(case.user_text, crisis)

            if experiment["text_signal"]:
                text_scores = text_emotion_scores(case.user_text)
                text_emotion = dominant_label(text_scores)
            else:
                text_scores = {label: 1 / len(config["emotion_labels"]) for label in config["emotion_labels"]}
                text_emotion = "neutral"

            if experiment["face_signal"]:
                fusion = fuse_emotions(text_scores, case.face_emotion, case.face_confidence)
                emotion = fusion["fused_emotion"]
                disagreement = fusion["disagreement_score"]
                confidence = fusion["fusion_confidence"]
                text_weight = fusion["text_weight"]
                image_weight = fusion["image_weight"]
                fused_scores = fusion["fused_scores"]
            else:
                emotion = text_emotion
                disagreement = 0.0
                confidence = round(max(text_scores.values()), 4)
                text_weight = 1.0 if experiment["text_signal"] else 0.0
                image_weight = 0.0
                fused_scores = text_scores

            strategy = route_strategy(emotion, crisis, distress)
            reply = response_stub(strategy, emotion, experiment["condition_response"])
            strategy_confidence = 0.99 if strategy == "escalation" else 0.72 if strategy == "reflective_listening" else 0.76
            fallback_triggered, fallback_mode = fallback_reason(confidence, disagreement, strategy_confidence, distress)

            rows.append({
                "experiment_id": experiment["id"],
                "label": experiment["label"],
                "case_id": case.id,
                "predicted_emotion": emotion,
                "expected_emotion": case.expected_emotion,
                "emotion_match": score_prediction(emotion, case.expected_emotion),
                "predicted_strategy": strategy,
                "strategy_confidence": strategy_confidence,
                "expected_strategy": case.expected_strategy,
                "strategy_match": score_prediction(strategy, case.expected_strategy),
                "predicted_distress": distress,
                "expected_distress": case.expected_distress,
                "distress_match": score_prediction(distress, case.expected_distress),
                "crisis_detected": crisis,
                "expected_crisis": case.crisis,
                "crisis_match": score_prediction(str(crisis), str(case.crisis)),
                "confidence": confidence,
                "text_weight": text_weight,
                "image_weight": image_weight,
                "disagreement_score": disagreement,
                "fallback_triggered": fallback_triggered,
                "fallback_reason": fallback_mode,
                "fused_top_1": emotion,
                "fused_top_2": sorted(fused_scores.items(), key=lambda item: item[1], reverse=True)[1][0],
                "reply_preview": reply,
            })

    summary = summarize_metrics(rows, "label")
    ablation_dir = output_dir / "ablations"
    write_csv(ablation_dir / "case_level.csv", rows)
    write_json(ablation_dir / "case_level.json", rows)
    write_csv(ablation_dir / "summary.csv", summary)
    write_json(ablation_dir / "summary.json", summary)
    write_markdown_table(ablation_dir / "summary.md", "Ablation Summary", summary)
    write_bar_chart_svg(ablation_dir / "emotion_accuracy.svg", "Ablation Emotion Accuracy", summary, "label", "emotion_accuracy")
    write_bar_chart_svg(ablation_dir / "strategy_accuracy.svg", "Ablation Strategy Accuracy", summary, "label", "strategy_accuracy")


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    config = load_config(project_root)
    output_dir = project_root / config["output_dir"]
    run_ablation(config, output_dir)


if __name__ == "__main__":
    main()
