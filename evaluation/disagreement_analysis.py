from __future__ import annotations

from pathlib import Path

from evaluation.reporting import read_csv, write_csv, write_json, write_markdown_table


def run_disagreement_analysis(output_dir: Path) -> list[dict]:
    rows = [row for row in read_csv(output_dir / "ablations" / "case_level.csv") if row["experiment_id"] in {"limbic_sensory_prefrontal", "full_fused_conditioned"}]
    grouped = {}
    for row in rows:
        key = row["label"]
        grouped.setdefault(key, {"disagreement": [], "fallback": [], "emotion_match": []})
        grouped[key]["disagreement"].append(float(row["disagreement_score"]))
        grouped[key]["fallback"].append(1.0 if row.get("fallback_triggered", "False") == "True" else 0.0)
        grouped[key]["emotion_match"].append(float(row["emotion_match"]))

    out = []
    for label, values in grouped.items():
        out.append({
            "label": label,
            "avg_disagreement": round(sum(values["disagreement"]) / len(values["disagreement"]), 3),
            "fallback_activation_rate": round(sum(values["fallback"]) / len(values["fallback"]), 3),
            "emotion_accuracy": round(sum(values["emotion_match"]) / len(values["emotion_match"]), 3),
            "n_cases": len(values["disagreement"]),
        })
    out.sort(key=lambda item: item["label"])

    base = output_dir / "analysis"
    write_csv(base / "disagreement_analysis.csv", out)
    write_json(base / "disagreement_analysis.json", out)
    write_markdown_table(base / "disagreement_analysis.md", "Disagreement Analysis", out)
    return out
