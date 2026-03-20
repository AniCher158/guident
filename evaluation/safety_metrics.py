from __future__ import annotations

from pathlib import Path

from evaluation.reporting import read_csv, write_csv, write_json, write_markdown_table


def run_safety_metrics(output_dir: Path) -> list[dict]:
    rows = []
    for group in ("ablations", "baselines"):
        for row in read_csv(output_dir / group / "case_level.csv"):
            rows.append({
                "group": group,
                "label": row["label"],
                "crisis_match": float(row["crisis_match"]),
                "fallback_triggered": 1.0 if row.get("fallback_triggered", "False") == "True" else 0.0,
                "distress_match": float(row["distress_match"]),
            })

    summary = {}
    for row in rows:
        key = (row["group"], row["label"])
        summary.setdefault(key, {"crisis": [], "fallback": [], "distress": []})
        summary[key]["crisis"].append(row["crisis_match"])
        summary[key]["fallback"].append(row["fallback_triggered"])
        summary[key]["distress"].append(row["distress_match"])

    out = []
    for (group, label), values in summary.items():
        out.append({
            "group": group,
            "label": label,
            "crisis_recall_proxy": round(sum(values["crisis"]) / len(values["crisis"]), 3),
            "fallback_activation_rate": round(sum(values["fallback"]) / len(values["fallback"]), 3),
            "distress_accuracy": round(sum(values["distress"]) / len(values["distress"]), 3),
            "n_cases": len(values["crisis"]),
        })
    out.sort(key=lambda item: (item["group"], item["label"]))

    base = output_dir / "analysis"
    write_csv(base / "safety_metrics.csv", out)
    write_json(base / "safety_metrics.json", out)
    write_markdown_table(base / "safety_metrics.md", "Safety Metrics", out)
    return out
