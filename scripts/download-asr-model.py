"""Download a public CTranslate2 model with bounded parallel ranges and SHA-256."""
import concurrent.futures
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = 'Systran/faster-whisper-small'
DEST = ROOT / '.local' / 'asr-model'
PARTS = ROOT / '.local' / 'asr-download'
DEST.mkdir(parents=True, exist_ok=True)
PARTS.mkdir(parents=True, exist_ok=True)
manifest = subprocess.check_output(['curl', '-fsSL', '--retry', '2', '--max-time', '30', f'https://huggingface.co/api/models/{MODEL}/tree/main?recursive=false&expand=false'])
metadata = next(item for item in json.loads(manifest) if item['path'] == 'model.bin')
size = metadata['size']
expected_hash = metadata['lfs']['oid']
model = DEST / 'model.bin'

def sha256(file):
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()

if model.exists() and model.stat().st_size == size and sha256(model) == expected_hash:
    print('ASR model already downloaded and verified.', flush=True)
    raise SystemExit(0)

partial = DEST / 'model.bin.partial'
if model.exists():
    model.replace(partial)
chunk_size = 12 * 1024 * 1024
count = math.ceil(size / chunk_size)
# Only reuse complete leading chunks. The final merged model is verified below.
if partial.exists():
    with partial.open('rb') as stream:
        for index in range(min(count, partial.stat().st_size // chunk_size)):
            file = PARTS / f'{index:03}.part'
            block = stream.read(chunk_size)
            if not file.exists():
                file.write_bytes(block)

def download(index):
    start = index * chunk_size
    end = min(size - 1, start + chunk_size - 1)
    file = PARTS / f'{index:03}.part'
    if file.exists() and file.stat().st_size == end - start + 1:
        return index
    headers = PARTS / f'{index:03}.headers'
    subprocess.run(['curl', '--http1.1', '--tlsv1.2', '--tls-max', '1.2', '-fsSL', '--retry', '2', '--retry-all-errors', '--connect-timeout', '15', '--max-time', '120', '-r', f'{start}-{end}', '-D', str(headers), '-o', str(file), f'https://huggingface.co/{MODEL}/resolve/main/model.bin?download=true&part={index}'], check=True)
    ranges = re.findall(r'content-range:\s*bytes\s+(\d+)-(\d+)/(\d+)', headers.read_text().lower())
    if not ranges or tuple(map(int, ranges[-1])) != (start, end, size) or file.stat().st_size != end - start + 1:
        file.unlink(missing_ok=True)
        raise RuntimeError(f'Incorrect downloaded byte range for part {index}.')
    return index

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    futures = [pool.submit(download, index) for index in range(count)]
    for completed, future in enumerate(concurrent.futures.as_completed(futures), 1):
        future.result()
        print(f'Model download: {completed}/{count} parts ready', flush=True)

assembled = DEST / 'model.bin.verified-tmp'
with assembled.open('wb') as output:
    for index in range(count):
        with (PARTS / f'{index:03}.part').open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                output.write(block)
if assembled.stat().st_size != size or sha256(assembled) != expected_hash:
    raise RuntimeError('ASR model checksum mismatch; incomplete file was not activated.')
assembled.replace(model)
partial.unlink(missing_ok=True)
for file in PARTS.glob('*'):
    file.unlink()
print(f'ASR model verified: {size} bytes; SHA-256 {expected_hash}', flush=True)
