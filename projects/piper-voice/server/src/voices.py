import rhpy
import time
from piper import PiperVoice

from config import Config

log = rhpy.logs('voices')

voice_cache: dict[str, PiperVoice] = {}

def load(voice_name: str):
	onnx_name = f'{voice_name}.onnx'
	start_time = time.time()
	voice = PiperVoice.load(Config.voices_dir / onnx_name, download_dir=Config.voices_dir, use_cuda=Config.cuda)
	elapsed_time = rhpy.seconds_elapsed(start_time)
	voice_cache[voice_name] = voice

	log.info(f"Loaded voice model '{voice_name}' in {elapsed_time}s")
	return voice_cache[voice_name]

def get(voice_name: str) -> PiperVoice:
	if voice_name not in voice_cache:
		voice_cache[voice_name] = load(voice_name)
	return voice_cache[voice_name]
