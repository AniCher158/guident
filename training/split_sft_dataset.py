import argparse
import json
import random
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Split Guident SFT JSONL into train/val sets.")
    parser.add_argument(
        "--input",
        default="artifacts/training/guident_sft_clean.jsonl",
        help="Path to cleaned JSONL file.",
    )
    parser.add_argument(
        "--output-dir",
        default="artifacts/training/splits",
        help="Directory where train/val JSONL files will be written.",
    )
    parser.add_argument("--val-ratio", type=float, default=0.02, help="Validation ratio.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    rows = [json.loads(line) for line in input_path.read_text().splitlines() if line.strip()]
    rng = random.Random(args.seed)
    rng.shuffle(rows)

    val_count = max(1, int(len(rows) * args.val_ratio))
    val_rows = rows[:val_count]
    train_rows = rows[val_count:]

    train_path = output_dir / "train.jsonl"
    val_path = output_dir / "val.jsonl"
    stats_path = output_dir / "split_stats.json"

    train_path.write_text("".join(f"{json.dumps(row, ensure_ascii=False)}\n" for row in train_rows))
    val_path.write_text("".join(f"{json.dumps(row, ensure_ascii=False)}\n" for row in val_rows))
    stats_path.write_text(
        json.dumps(
            {
                "input_rows": len(rows),
                "train_rows": len(train_rows),
                "val_rows": len(val_rows),
                "val_ratio": args.val_ratio,
                "seed": args.seed,
            },
            indent=2,
        )
    )

    print(json.dumps({"train_path": str(train_path), "val_path": str(val_path), "stats_path": str(stats_path)}, indent=2))


if __name__ == "__main__":
    main()
