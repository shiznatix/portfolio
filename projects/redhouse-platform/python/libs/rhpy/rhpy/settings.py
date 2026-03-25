import json
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, ClassVar

from pydantic import ConfigDict, Field

from .model import Model
from . import logger

log = logger.get('settings')

@dataclass
class _State:
	file_path: Path | None = None
	timer: threading.Timer | None = None
	lock: threading.Lock = field(default_factory=threading.Lock)

_registry: dict[int, _State] = {}

class Settings(Model):
	model_config = ConfigDict(arbitrary_types_allowed=True, validate_assignment=True)
	"""Persistent per-instance settings backed by a JSON file.

	Fields are loaded from ``<cwd>/<settings_dir>/<name>.json`` on init and
	auto-saved (debounced by ``save_delay`` seconds) whenever a field changes.

	Example::

		class AppSettings(Settings):
			name: str = Field(default='app', exclude=True)
			volume: float = 0.8

		s = AppSettings()
		s.volume = 0.5  # schedules a save automatically
	"""
	name: str = Field(exclude=True)
	settings_dir: ClassVar[Path] = Path('user-settings')
	save_delay: ClassVar[float] = 1.0

	def _state(self) -> _State:
		return _registry[id(self)]

	def model_post_init(self, _context: Any) -> None:  # pylint: disable=arguments-differ
		_registry[id(self)] = _State()
		file_name = self.name if f'{self.name}'.endswith('.json') else f'{self.name}.json'
		file_path = Path.cwd() / self.settings_dir / file_name
		if file_path.is_file():
			with file_path.open(encoding='utf8') as fh:
				saved = json.load(fh)
			for key, value in saved.items():
				try:
					setattr(self, key, value)
				except Exception:
					pass
		log.info(f"Settings initialized for '{self.name}' with file path: {file_path}")
		# Set file_path last so setattr calls above don't trigger saves
		self._state().file_path = file_path

	def __setattr__(self, name: str, value: Any) -> None:
		super().__setattr__(name, value)
		if not name.startswith('_'):
			self._schedule_save()

	def _schedule_save(self) -> None:
		state = _registry.get(id(self))
		if state is None or state.file_path is None:
			return
		with state.lock:
			if state.timer is not None:
				state.timer.cancel()
			timer = threading.Timer(self.save_delay, self._write)
			timer.daemon = True
			timer.start()
			state.timer = timer

	def _write(self) -> None:
		state = _registry.get(id(self))
		if state is None or state.file_path is None:
			return
		data = self.model_dump(mode='json')
		state.file_path.parent.mkdir(parents=True, exist_ok=True)
		with state.file_path.open('w', encoding='utf8') as fh:
			json.dump(data, fh, indent=4)
		log.info(f"Settings '{self.name}' saved to {state.file_path}")

	def save_now(self) -> None:
		"""Cancel any pending debounced save and write to disk immediately."""
		state = _registry.get(id(self))
		if state is None:
			return
		with state.lock:
			if state.timer is not None:
				state.timer.cancel()
				state.timer = None
		self._write()
