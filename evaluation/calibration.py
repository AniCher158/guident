from __future__ import annotations

from pathlib import Path

from evaluation.reporting import read_csv, write_csv, write_json, write_markdown_table, write_bar_chart_svg


def _ece(rows: list[dict], bins: int = 5) -> tuple[list[dict], float]:
    bucket_rows = []
    total = len(rows) or 1
    ece = 0.0
    for idx in range(bins):
        lo = idx / bins
        hi = (idx + 1) / bins
        bucket = [row for row in rows if lo <= float(row["confidence"]) < hi or (idx == bins - 1 and float(row["confidence"]) == hi)]
        if not bucket:
            bucket_rows.append({"bin": f"{lo:.1f}-{hi:.1f}", "count": 0, "avg_confidence": 0.0, "accuracy": 0.0, "gap": 0.0})
            continue
        avg_conf = sum(float(row["confidence"]) for row in bucket) / len(bucket)
        acc = sum(float(row["emotion_match"]) for row in bucket) / len(bucket)
        gap = abs(avg_conf - acc)
        ece += (len(bucket) / total) * gap
        bucket_rows.append({
            "bin": f"{lo:.1f}-{hi:.1f}",
            "count": len(bucket),
            "avg_confidence": round(avg_conf, 3),
            "accuracy": round(acc, 3),
            "gap": round(gap, 3),
        })
    return bucket_rows, round(ece, 3)


def run_calibration(output_dir: Path) -> list[dict]:
    out = []
    analysis_dir = output_dir / "analysis"
    for group in ("ablations", "baselines"):
        rows = read_csv(output_dir / group / "case_level.csv")
        bucket_rows, ece = _ece(rows)
        write_csv(analysis_dir / f"{group}_calibration_bins.csv", bucket_rows)
        write_json(analysis_dir / f"{group}_calibration_bins.json", bucket_rows)
        write_markdown_table(analysis_dir / f"{group}_calibration_bins.md", f"{group.title()} Calibration Bins", bucket_rows)
        write_bar_chart_svg(analysis_dir / f"{group}_calibration_gap.svg", f"{group.title()} Calibration Gap", bucket_rows, "bin", "gap")
        out.append({"group": group, "ece": ece, "n_cases": len(rows)})

    write_csv(analysis_dir / "calibration_summary.csv", out)
    write_json(analysis_dir / "calibration_summary.json", out)
    write_markdown_table(analysis_dir / "calibration_summary.md", "Calibration Summary", out)
    return out
