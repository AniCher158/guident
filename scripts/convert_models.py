#!/usr/bin/env python3
"""
convert_models.py — Convert all pretrained models for on-device inference.

Usage:
  python3 scripts/convert_models.py              # all models
  python3 scripts/convert_models.py --model distilbert
  python3 scripts/convert_models.py --model fer2013
  python3 scripts/convert_models.py --model phi2

Outputs (relative to project root):
  assets/models/distilbert_empathy.onnx   (~65 MB, INT8)
  assets/models/fer2013.tflite            (~30 MB, dynamic-range quantized)
  assets/models/phi2_q4.gguf             (~1.5 GB, Q4_K_M) — sideload to device
"""

import argparse
import os
import shutil
import subprocess
import sys
import tarfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRETRAINED = os.path.join(ROOT, "pretrained")
ASSETS_MODELS = os.path.join(ROOT, "assets", "models")


def run(cmd: str, **kwargs):
    print(f"$ {cmd}")
    subprocess.run(cmd, shell=True, check=True, **kwargs)


def ensure(path: str):
    os.makedirs(path, exist_ok=True)


# ──────────────────────────────────────────────────────────────────────────────
# DistilBERT (safetensors → ONNX → INT8)
# ──────────────────────────────────────────────────────────────────────────────

def convert_distilbert():
    print("\n=== DistilBERT: safetensors → ONNX INT8 ===")
    run("pip3 install -q transformers optimum[onnxruntime] onnxruntime-tools")

    from onnxruntime.quantization import quantize_dynamic, QuantType  # type: ignore

    src = os.path.join(PRETRAINED, "distilbert_empathy_model")
    tmp = os.path.join(PRETRAINED, "_distilbert_onnx_fp32")
    dst = os.path.join(ASSETS_MODELS, "distilbert_empathy.onnx")

    ensure(tmp)
    # Export FP32 ONNX
    run(f'python3 -m optimum.exporters.onnx --model "{src}" --task text-classification "{tmp}"')

    fp32_path = os.path.join(tmp, "model.onnx")
    quantize_dynamic(fp32_path, dst, weight_type=QuantType.QInt8)
    shutil.rmtree(tmp)

    size_mb = os.path.getsize(dst) / 1e6
    print(f"✓ Saved {dst} ({size_mb:.1f} MB)")


# ──────────────────────────────────────────────────────────────────────────────
# FER2013 CNN (TF SavedModel → TFLite, dynamic-range quantized)
# ──────────────────────────────────────────────────────────────────────────────

def convert_fer2013():
    print("\n=== FER2013: TF SavedModel → TFLite (dynamic-range quant) ===")
    run("pip3 install -q tensorflow")

    import tensorflow as tf  # type: ignore

    src = os.path.join(PRETRAINED, "fer2013_cnn_savedmodel")
    dst = os.path.join(ASSETS_MODELS, "fer2013.tflite")

    converter = tf.lite.TFLiteConverter.from_saved_model(src)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_bytes = converter.convert()

    with open(dst, "wb") as f:
        f.write(tflite_bytes)

    # Inspect input/output shapes so the JS service can use them
    interp = tf.lite.Interpreter(model_content=tflite_bytes)
    interp.allocate_tensors()
    print("  Input details: ", interp.get_input_details())
    print("  Output details:", interp.get_output_details())

    size_mb = os.path.getsize(dst) / 1e6
    print(f"✓ Saved {dst} ({size_mb:.1f} MB)")


# ──────────────────────────────────────────────────────────────────────────────
# Phi-2 (.pth → HuggingFace → GGUF → Q4_K_M)
# ──────────────────────────────────────────────────────────────────────────────

def download_phi2_prebuilt():
    """
    Downloads a pre-quantized Phi-2 Q4_K_M GGUF from HuggingFace.
    Use this if the local .pth tar is incomplete.
    (~1.6 GB download)
    """
    import urllib.request

    url = "https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf"
    dst = os.path.join(ASSETS_MODELS, "phi2_q4.gguf")
    ensure(ASSETS_MODELS)

    if os.path.exists(dst):
        print(f"Already exists: {dst}")
        return

    print(f"Downloading Phi-2 Q4_K_M GGUF (~1.6 GB)…")
    print(f"From: {url}")

    def progress(block, block_size, total):
        done = block * block_size
        pct = done / total * 100 if total > 0 else 0
        print(f"\r  {pct:.1f}% ({done / 1e9:.2f} / {total / 1e9:.2f} GB)", end="", flush=True)

    urllib.request.urlretrieve(url, dst, reporthook=progress)
    print(f"\n✓ Saved {dst} ({os.path.getsize(dst) / 1e9:.2f} GB)")
    print()
    print("Sideload to device: Finder → iPhone → Files → Guident → drag phi2_q4.gguf in")


def convert_phi2():
    print("\n=== Phi-2: .pth → GGUF Q4_K_M ===")
    run("pip3 install -q transformers accelerate safetensors")

    import torch  # type: ignore
    from transformers import AutoConfig, AutoModelForCausalLM, AutoTokenizer  # type: ignore

    tar_path = os.path.join(PRETRAINED, "model", "phi2_export_bundle.tar")
    extract_dir = os.path.join(PRETRAINED, "_phi2_extracted")
    hf_dir = os.path.join(PRETRAINED, "_phi2_hf")
    gguf_fp16 = os.path.join(PRETRAINED, "_phi2_fp16.gguf")
    gguf_q4 = os.path.join(ASSETS_MODELS, "phi2_q4.gguf")

    # 1. Extract
    if not os.path.exists(os.path.join(extract_dir, "phi2_export_bundle", "model.pth")):
        print("Extracting tar (this may take a while for 9.3 GB)…")
        ensure(extract_dir)
        with tarfile.open(tar_path, "r") as t:
            t.extractall(extract_dir)

    pth_path = os.path.join(extract_dir, "phi2_export_bundle", "model.pth")

    # 2. Load state dict and save in HuggingFace format
    print("Loading state dict (may take several minutes)…")
    state_dict = torch.load(pth_path, map_location="cpu", weights_only=True)

    print("Fetching microsoft/phi-2 architecture config…")
    config = AutoConfig.from_pretrained("microsoft/phi-2", trust_remote_code=True)
    tokenizer = AutoTokenizer.from_pretrained("microsoft/phi-2", trust_remote_code=True)

    model = AutoModelForCausalLM.from_config(config)

    # Handle possible key prefix differences
    for strict in (True, False):
        try:
            sd = state_dict
            if not strict:
                # strip common prefixes
                sd = {k.removeprefix("model.").removeprefix("transformer."): v for k, v in state_dict.items()}
            model.load_state_dict(sd, strict=strict)
            print(f"State dict loaded (strict={strict})")
            break
        except RuntimeError as e:
            if strict:
                print(f"Strict load failed, retrying non-strict… ({e})")
            else:
                raise

    ensure(hf_dir)
    model.save_pretrained(hf_dir, safe_serialization=True)
    tokenizer.save_pretrained(hf_dir)
    print(f"HuggingFace model saved to {hf_dir}")

    # 3. Clone llama.cpp and convert to GGUF
    llama_dir = os.path.join(ROOT, "scripts", "llama.cpp")
    if not os.path.exists(llama_dir):
        run(f'git clone --depth 1 https://github.com/ggerganov/llama.cpp "{llama_dir}"')
    run(f'pip3 install -q -r "{llama_dir}/requirements.txt"')
    run(
        f'python3 "{llama_dir}/convert_hf_to_gguf.py" "{hf_dir}" '
        f'--outfile "{gguf_fp16}" --outtype f16'
    )

    # 4. Build llama-quantize and quantize to Q4_K_M
    build_dir = os.path.join(llama_dir, "build")
    quantize_bin = os.path.join(build_dir, "bin", "llama-quantize")
    if not os.path.exists(quantize_bin):
        run(
            f'cmake -B "{build_dir}" "{llama_dir}" -DLLAMA_METAL=ON '
            f'&& cmake --build "{build_dir}" --config Release -j4 --target llama-quantize'
        )
    run(f'"{quantize_bin}" "{gguf_fp16}" "{gguf_q4}" Q4_K_M')
    os.remove(gguf_fp16)

    size_gb = os.path.getsize(gguf_q4) / 1e9
    print(f"✓ Saved {gguf_q4} ({size_gb:.2f} GB)")
    print()
    print("─" * 60)
    print("IMPORTANT: The GGUF file is too large to bundle in the app.")
    print("Sideload it to the device's Documents directory:")
    print()
    print(f"  1. Connect iPhone via USB")
    print(f"  2. Open Finder → iPhone → Files → Guident")
    print(f"  3. Drag phi2_q4.gguf into the Guident folder")
    print()
    print("The app will detect it at runtime from FileSystem.documentDirectory.")
    print("─" * 60)


# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        choices=["all", "distilbert", "fer2013", "phi2", "phi2-prebuilt"],
        default="all",
    )
    args = parser.parse_args()

    ensure(ASSETS_MODELS)

    if args.model in ("all", "distilbert"):
        convert_distilbert()
    if args.model in ("all", "fer2013"):
        convert_fer2013()
    if args.model in ("all", "phi2"):
        convert_phi2()
    if args.model == "phi2-prebuilt":
        download_phi2_prebuilt()

    print("\n=== Done. Run: npx expo run:ios --device <UDID> ===")
