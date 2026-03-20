from __future__ import annotations

from pathlib import Path

from evaluation.reporting import read_csv, write_csv, write_json, write_markdown_table


def token_set(text: str) -> set[str]:
    return {token.strip(".,;:!?()[]\"'").lower() for token in text.split() if token.strip()}


def run_semantic_metrics(output_dir: Path, cases_by_id: dict[str, dict]) -> list[dict]:
    rows = []
    for group in ("ablations", "baselines"):
        for row in read_csv(output_dir / group / "case_level.csv"):
            case = cases_by_id[row["case_id"]]
            overlap = token_set(case["user_text"]) & token_set(row["reply_preview"])
            union = token_set(case["user_text"]) | token_set(row["reply_preview"])
            score = 0.0 if not union else round(len(overlap) / len(union), 3)
            rows.append({
                "group": group,
                "label": row["label"],
                "case_id": row["case_id"],
                "semantic_overlap": score,
            })

    summary = {}
    for row in rows:
        key = (row["group"], row["label"])
        summary.setdefault(key, []).append(row["semantic_overlap"])

    out = [
        {"group": group, "label": label, "semantic_overlap": round(sum(vals) / len(vals), 3), "n_cases": len(vals)}
        for (group, label), vals in summary.items()
    ]
    out.sort(key=lambda item: (item["group"], item["label"]))
    base = output_dir / "analysis"
    write_csv(base / "semantic_metrics.csv", out)
    write_json(base / "semantic_metrics.json", out)
    write_markdown_table(base / "semantic_metrics.md", "Semantic Metrics", out)
    return out
