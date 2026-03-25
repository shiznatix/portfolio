from pydantic import model_validator
import rhpy
from pathlib import Path

class _Config(rhpy.Config):
	voices: list[str]
	voices_map: dict[str, str] = {}
	default_voice: str
	cuda: bool = False
	max_chars: int = 60000
	history_max_items: int = 100
	history_dir: Path = Path.cwd() / 'history'
	voices_dir: Path = Path.cwd() / 'voices'

	@model_validator(mode='after')
	def set_voices_map(self):
		self.voices_map = {voice.split('-')[1]: voice for voice in self.voices}
		return self

	def get_short_voice_name(self, name: str | None = None) -> str:
		if name is None:
			name = self.default_voice

		for short, full in self.voices_map.items():
			if name == full or name == short:
				return short
		raise ValueError(f"Voice '{name}' not found in config")
Config = _Config()
