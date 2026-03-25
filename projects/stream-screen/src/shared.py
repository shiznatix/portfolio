from enum import Enum
from dataclasses import asdict, dataclass


class ChangeDirection(Enum):
	INC = 'inc'
	DEC = 'dec'

class MenuName(Enum):
	STREAMS = 'streams'
	BRIGHTNESS = 'brightness'
	CONTRAST = 'contrast'
	def __str__(self):
		return self.value.capitalize()
	def to_prop(self):
		return self.value.lower()

class RtspStatus(Enum):
	NULL = 'null'
	CREATING = 'creating'
	STARTING = 'starting'
	CONNECTED = 'connected'
	PLAYING = 'playing'
	PAUSED = 'paused'
	ERROR = 'error'
	def __str__(self):
		return self.value.capitalize()

@dataclass
class LogfmtMixin:
	def __str__(self):
		items = []
		for k, v in asdict(self).items():
			if isinstance(v, str) and (any(c in v for c in ' =') or not v):
				v = f'"{v}"'
			items.append(f"{k}={v}")
		return " ".join(items)
