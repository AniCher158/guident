from __future__ import annotations

from pathlib import Path

from evaluation.calibration import run_calibration
from evaluation.disagreement_analysis import run_disagreement_analysis
from evaluation.emotion_alignment import run_emotion_alignment
from evaluation.reporting import write_csv, write_json, write_markdown_table
from evaluation.safety_metrics import run_safety_metrics
from evaluation.semantic_metrics import run_semantic_metrics
from experiments.ablation_runner import run_ablation
from experiments.baseline_runner import run_baselines
from experiments.common import load_config


def merge_summaries(output_dir: Path) -> None:
    import json

    ablations = json.loads((output_dir / "ablations" / "summary.json").read_text(encoding="utf-8"))
    baselines = json.loads((output_dir / "baselines" / "summary.json").read_text(encoding="utf-8"))
    combined = [{"group": "ablation", **row} for row in ablations] + [{"group": "baseline", **row} for row in baselines]
    write_csv(output_dir / "combined_summary.csv", combined)
    write_json(output_dir / "combined_summary.json", combined)
    write_markdown_table(output_dir / "combined_summary.md", "Combined Experiment Summary", combined)


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    config = load_config(project_root)
    output_dir = project_root / config["output_dir"]
    cases_by_id = {case["id"]: case for case in config["cases"]}
    run_ablation(config, output_dir)
    run_baselines(config, output_dir)
    merge_summaries(output_dir)
    run_semantic_metrics(output_dir, cases_by_id)
    run_emotion_alignment(output_dir)
    run_safety_metrics(output_dir)
    run_calibration(output_dir)
    run_disagreement_analysis(output_dir)


if __name__ == "__main__":
    main()
