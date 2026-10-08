"""Download the public multilingual ASR model. Runtime inference remains offline."""
import os
import subprocess
import sys
from pathlib import Path
from huggingface_hub import snapshot_download
root = Path(__file__).resolve().parent.parent
model = 'Systran/faster-whisper-small'
path = snapshot_download(model, local_dir=str(root / '.local' / 'asr-model'), allow_patterns=['config.json', 'tokenizer.json', 'vocabulary.*', 'preprocessor_config.json'], max_workers=3)
subprocess.run([sys.executable, str(root / 'scripts' / 'download-asr-model.py')], check=True)
print(f'ASR model ready: {path}', flush=True)
