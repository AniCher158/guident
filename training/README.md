# Llama 3.2 3B Instruct Training

This folder contains a Colab-friendly QLoRA pipeline for training `Llama 3.2 3B Instruct` on the cleaned Guident SFT dataset and later exporting toward GGUF / `llama.rn`.

## Files

- `split_sft_dataset.py`: deterministic train/validation split
- `train_llama32_3b_unsloth.py`: Unsloth QLoRA training script

## Recommended Colab Setup

Use an A100 runtime if available. Save outputs to Google Drive early so a runtime reset does not wipe checkpoints.

### 1. Install dependencies

```bash
!pip install -U unsloth "trl>=0.9.6" datasets accelerate bitsandbytes sentencepiece protobuf
```

### 2. Mount Drive

```python
from google.colab import drive
drive.mount("/content/drive")
```

### 3. Copy the repo and cleaned dataset into the Colab workspace

Options:

- Upload the repo to Drive and clone/copy it into `/content`
- Or upload only:
  - `training/train_llama32_3b_unsloth.py`
  - `training/split_sft_dataset.py`
  - `artifacts/training/guident_sft_clean.jsonl`

### 4. Split the dataset

```bash
!python training/split_sft_dataset.py \
  --input artifacts/training/guident_sft_clean.jsonl \
  --output-dir artifacts/training/splits \
  --val-ratio 0.02 \
  --seed 42
```

### 5. Run a small pilot first

Do not start with a full run. First confirm the pipeline works with a short pilot.

```bash
!python training/train_llama32_3b_unsloth.py \
  --train-file artifacts/training/splits/train.jsonl \
  --val-file artifacts/training/splits/val.jsonl \
  --output-dir /content/drive/MyDrive/guident_llama32_3b_lora_pilot \
  --batch-size 4 \
  --grad-accum 8 \
  --num-epochs 0.1 \
  --save-steps 100 \
  --eval-steps 100 \
  --logging-steps 10
```

### 6. Full run

After the pilot looks healthy, run the full training job.

```bash
!python training/train_llama32_3b_unsloth.py \
  --train-file artifacts/training/splits/train.jsonl \
  --val-file artifacts/training/splits/val.jsonl \
  --output-dir /content/drive/MyDrive/guident_llama32_3b_lora \
  --batch-size 4 \
  --grad-accum 8 \
  --num-epochs 1.5 \
  --save-steps 200 \
  --eval-steps 200 \
  --logging-steps 10
```

## Recommended Hyperparameters

Start here:

- Base model: `unsloth/Llama-3.2-3B-Instruct`
- Sequence length: `1536`
- LoRA rank: `16`
- LoRA alpha: `16`
- Learning rate: `2e-4`
- Batch size: `4`
- Gradient accumulation: `8`
- Epochs: `1.5`

This is a sensible starting point for behavior tuning on roughly `37.7k` cleaned rows. Do not assume more epochs are better.

## Output Artifacts

The training script writes:

- `adapter/`: LoRA adapter weights
- `merged_16bit/`: merged model for later export/conversion
- `training_summary.json`

## Path To GGUF Later

After the merged model looks good:

1. Export / keep the merged FP16 model
2. Convert it with `llama.cpp` tooling to GGUF
3. Quantize to a mobile-friendly format such as `Q4_K_M`
4. Evaluate on-device in `llama.rn`

Do not convert to GGUF before you have sampled outputs and validated behavior.

## Practical Advice

- Save checkpoints to Drive, not local Colab disk
- Expect runtime interruptions and plan to resume
- Keep a small held-out manual eval set of Guident-style prompts
- Validate tone and safety before chasing loss
