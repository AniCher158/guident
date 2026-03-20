from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Iterable


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: object) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_csv(path: Path, rows: Iterable[dict]) -> None:
    rows = list(rows)
    ensure_dir(path.parent)
    if not rows:
      path.write_text("", encoding="utf-8")
      return

    fieldnames = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_markdown_table(path: Path, title: str, rows: list[dict]) -> None:
    ensure_dir(path.parent)
    if not rows:
        path.write_text(f"# {title}\n\nNo rows.\n", encoding="utf-8")
        return

    headers = list(rows[0].keys())
    lines = [f"# {title}", "", "| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in rows:
        lines.append("| " + " | ".join(str(row[h]) for h in headers) + " |")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_bar_chart_svg(path: Path, title: str, rows: list[dict], label_key: str, value_key: str) -> None:
    ensure_dir(path.parent)
    width = 860
    height = 420
    left = 180
    top = 40
    bar_height = 34
    gap = 18
    max_value = max((float(row[value_key]) for row in rows), default=1.0)
    chart_width = width - left - 60

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        f'<text x="{left}" y="24" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">{title}</text>',
    ]

    for idx, row in enumerate(rows):
        y = top + idx * (bar_height + gap)
        value = float(row[value_key])
        bar_width = 0 if max_value == 0 else (value / max_value) * chart_width
        label = str(row[label_key])
        display = f"{value:.3f}"
        parts.extend([
            f'<text x="18" y="{y + 22}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#111827">{label}</text>',
            f'<rect x="{left}" y="{y}" width="{bar_width:.1f}" height="{bar_height}" rx="6" fill="#3157d5"/>',
            f'<text x="{left + bar_width + 10:.1f}" y="{y + 22}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#111827">{display}</text>',
        ])

    parts.append("</svg>")
    path.write_text("\n".join(parts), encoding="utf-8")
