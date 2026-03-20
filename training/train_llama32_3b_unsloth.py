import argparse
import json
from pathlib import Path

from datasets import load_dataset
from trl import SFTTrainer, SFTConfig
from unsloth import FastLanguageModel, is_bfloat16_supported


DEFAULT_MODEL = "unsloth/Llama-3.2-3B-Instruct"
DEFAULT_SYSTEM_PROMPT = (
    "You are Guident, a supportive reflection assistant for teenagers. "
    "Respond warmly and specifically. Validate feelings, avoid diagnosis, "
    "avoid pretending to be a therapist, and encourage trusted offline support when risk is elevated."
)


def format_messages(example: dict, tokenizer) -> dict:
    messages = example["messages"]
    if not messages or messages[0]["role"] != "system":
        messages = [{"role": "system", "content": DEFAULT_SYSTEM_PROMPT}, *messages]

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
    )
    return {"text": text}


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Llama 3.2 3B Instruct with Unsloth QLoRA.")
    parser.add_argument("--train-file", default="artifacts/training/splits/train.jsonl")
    parser.add_argument("--val-file", default="artifacts/training/splits/val.jsonl")
    parser.add_argument("--base-model", default=DEFAULT_MODEL)
    parser.add_argument("--output-dir", default="/content/drive/MyDrive/guident_llama32_3b_lora")
    parser.add_argument("--max-seq-length", type=int, default=1536)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--grad-accum", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--num-epochs", type=float, default=1.5)
    parser.add_argument("--warmup-steps", type=int, default=50)
    parser.add_argument("--save-steps", type=int, default=200)
    parser.add_argument("--eval-steps", type=int, default=200)
    parser.add_argument("--logging-steps", type=int, default=10)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=16)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    train_path = Path(args.train_file)
    val_path = Path(args.val_file)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        lora_alpha=args.lora_alpha,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=args.seed,
        use_rslora=False,
        loftq_config=None,
    )

    dataset = load_dataset(
        "json",
        data_files={"train": str(train_path), "validation": str(val_path)},
    )
    dataset = dataset.map(lambda ex: format_messages(ex, tokenizer), remove_columns=dataset["train"].column_names)

    training_args = SFTConfig(
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        packing=False,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        warmup_steps=args.warmup_steps,
        num_train_epochs=args.num_epochs,
        learning_rate=args.learning_rate,
        logging_steps=args.logging_steps,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        seed=args.seed,
        output_dir=str(output_dir),
        report_to="none",
        eval_strategy="steps",
        eval_steps=args.eval_steps,
        save_steps=args.save_steps,
        bf16=is_bfloat16_supported(),
        fp16=not is_bfloat16_supported(),
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        args=training_args,
    )

    trainer_stats = trainer.train()
    trainer.save_model(str(output_dir / "adapter"))
    tokenizer.save_pretrained(str(output_dir / "adapter"))

    merged_dir = output_dir / "merged_16bit"
    model.save_pretrained_merged(str(merged_dir), tokenizer, save_method="merged_16bit")

    summary = {
        "base_model": args.base_model,
        "train_file": str(train_path),
        "val_file": str(val_path),
        "output_dir": str(output_dir),
        "train_runtime": trainer_stats.metrics.get("train_runtime") if getattr(trainer_stats, "metrics", None) else None,
    }
    (output_dir / "training_summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
