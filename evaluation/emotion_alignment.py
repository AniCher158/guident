from __future__ import annotations

from pathlib import Path

from evaluation.reporting import read_csv, write_csv, write_json, write_markdown_table


def run_emotion_alignment(output_dir: Path) -> list[dict]:
    rows = []
    for group in ("ablations", "baselines"):
        for row in read_csv(output_dir / group / "case_level.csv"):
            rows.append({
                "group": group,
                "label": row["label"],
                "case_id": row["case_id"],
                "emotion_alignment": float(row["emotion_match"]),
                "strategy_alignment": float(row["strategy_match"]),
            })

    summary = {}
    for row in rows:
      key = (row["group"], row["label"])
      summary.setdefault(key, {"emotion": [], "strategy": []})
      summary[key]["emotion"].append(row["emotion_alignment"])
      summary[key]["strategy"].append(row["strategy_alignment"])

    out = []
    for (group, label), values in summary.items():
        out.append({
            "group": group,
            "label": label,
            "emotion_alignment": round(sum(values["emotion"]) / len(values["emotion"]), 3),
            "strategy_alignment": round(sum(values["strategy"]) / len(values["strategy"]), 3),
            "n_cases": len(values["emotion"]),
        })
    out.sort(key=lambda item: (item["group"], item["label"]))

    base = output_dir / "analysis"
    write_csv(base / "emotion_alignment.csv", out)
    write_json(base / "emotion_alignment.json", out)
    write_markdown_table(base / "emotion_alignment.md", "Emotion Alignment", out)
    return out
