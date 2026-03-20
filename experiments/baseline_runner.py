from __future__ import annotations

from pathlib import Path

from evaluation.reporting import write_bar_chart_svg, write_csv, write_json, write_markdown_table
from experiments.common import (
    detect_crisis,
    distress_level,
    dominant_label,
    fallback_reason,
    load_cases,
    load_config,
    response_stub,
    route_strategy,
    score_prediction,
    sentiment_label,
    summarize_metrics,
    text_emotion_scores,
)


def run_baselines(config: dict, output_dir: Path) -> None:
    cases = load_cases(config)
    rows = []

    for baseline in config["baselines"]:
        for case in cases:
            crisis = detect_crisis(case.user_text)
            distress = distress_level(case.user_text, crisis)

            if baseline["kind"] == "generic_chatbot":
                emotion = "neutral"
                strategy = "validation"
                confidence = 0.4
                strategy_confidence = 0.5
            elif baseline["kind"] == "text_only_emotion":
                text_scores = text_emotion_scores(case.user_text)
                emotion = dominant_label(text_scores)
                strategy = route_strategy(emotion, crisis, distress)
                confidence = max(text_scores.values())
                strategy_confidence = 0.76
            else:
                emotion = sentiment_label(case.user_text)
                strategy = "validation" if emotion != "hopeful" else "encouragement"
                confidence = 0.55
                strategy_confidence = 0.52

            fallback_triggered, fallback_mode = fallback_reason(confidence, 0.0, strategy_confidence, distress)

            rows.append({
                "baseline_id": baseline["id"],
                "label": baseline["label"],
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
                "confidence": round(float(confidence), 4),
                "fallback_triggered": fallback_triggered,
                "fallback_reason": fallback_mode,
                "reply_preview": response_stub(strategy, emotion, False),
            })

    summary = summarize_metrics(rows, "label")
    baseline_dir = output_dir / "baselines"
    write_csv(baseline_dir / "case_level.csv", rows)
    write_json(baseline_dir / "case_level.json", rows)
    write_csv(baseline_dir / "summary.csv", summary)
    write_json(baseline_dir / "summary.json", summary)
    write_markdown_table(baseline_dir / "summary.md", "Baseline Summary", summary)
    write_bar_chart_svg(baseline_dir / "emotion_accuracy.svg", "Baseline Emotion Accuracy", summary, "label", "emotion_accuracy")
    write_bar_chart_svg(baseline_dir / "strategy_accuracy.svg", "Baseline Strategy Accuracy", summary, "label", "strategy_accuracy")


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    config = load_config(project_root)
    output_dir = project_root / config["output_dir"]
    run_baselines(config, output_dir)


if __name__ == "__main__":
    main()
