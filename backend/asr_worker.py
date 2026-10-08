"""A persistent, offline Whisper worker. Audio is never sent to an external API."""
import json
import os
import sys
import time
from pathlib import Path

def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

try:
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    from opencc import OpenCC
    model_path = Path(os.environ.get('BANTING_ASR_MODEL_DIR', Path(__file__).resolve().parent.parent / '.local' / 'asr-model'))
    model = WhisperModel(str(model_path), device='cpu', compute_type='int8', cpu_threads=min(4, os.cpu_count() or 2), local_files_only=True)
    converter = OpenCC('t2s')
    emit({'type': 'ready', 'model': 'Whisper small', 'device': 'cpu', 'offline': True})
except Exception as exc:
    print(f'ASR startup failed: {exc}', file=sys.stderr, flush=True)
    emit({'type': 'failed', 'error': '本地语音识别尚未就绪，请完成 ASR 安装并重启预览。'})
    sys.exit(1)

for line in sys.stdin:
    request = None
    try:
        request = json.loads(line)
        started = time.monotonic()
        samples = decode_audio(request['path'], sampling_rate=16000)
        duration = len(samples) / 16000
        if duration > 180:
            emit({'id': request['id'], 'error': '请将每条想法控制在 3 分钟以内。', 'code': 'too_long'})
            continue
        if duration < 0.35:
            emit({'id': request['id'], 'text': '', 'segments': [], 'duration': duration, 'noSpeech': True, 'elapsedMs': 0})
            continue
        segments, info = model.transcribe(samples, language='zh', beam_size=3, vad_filter=True,
            vad_parameters={'min_silence_duration_ms': 450, 'speech_pad_ms': 180},
            condition_on_previous_text=False, temperature=0.0)
        result = []
        for segment in segments:
            text = converter.convert(segment.text.strip())
            if text:
                result.append({'start': round(segment.start, 2), 'end': round(segment.end, 2), 'text': text})
        text = ''.join(s['text'] for s in result).strip()
        emit({'id': request['id'], 'text': text, 'segments': result, 'duration': round(duration, 2),
              'noSpeech': not bool(text), 'elapsedMs': round((time.monotonic() - started) * 1000),
              'provider': 'local-whisper', 'model': 'Whisper small', 'language': 'zh'})
    except Exception as exc:
        print(f'ASR request failed: {type(exc).__name__}', file=sys.stderr, flush=True)
        emit({'id': request.get('id') if request else None, 'error': '这段录音暂时无法识别，请保留原录音并重试。', 'code': 'decode_failed'})
