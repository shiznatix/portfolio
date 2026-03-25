from states import ActiveState
from config import Config

from .menus import MenuStreams as MenuStreamsOverlay, MenuBrightness as MenuBrightnessOverlay, MenuContrast as MenuContrastOverlay
from .name import Name as NameOverlay
from .stream_status import StreamStatus as StreamStatusOverlay
from .timestamp import Timestamp as TimestampOverlay
from .notifications import Notifications as NotificationsOverlay
from .detections import Detections as DetectionsOverlay


class _Overlays:
	@property
	def stream_status(self):
		return self._stream_status[ActiveState.stream.name]
	@property
	def stream_detections(self):
		return self._stream_detections[ActiveState.stream.name]

	def __init__(self):
		self._stream_status = { c.name: StreamStatusOverlay(c.name) for c in Config.streams }
		self._stream_detections = {
			c.name: DetectionsOverlay(
				c.name,
				active=(c.name == ActiveState.stream.name),
				enabled=bool(c.detections_source),
			)
			for c in Config.streams
		}
		self.name = NameOverlay(ActiveState.stream.name)
		self.menu_streams = MenuStreamsOverlay(ActiveState.menu, ActiveState.stream_index, Config.streams)
		self.menu_brightness = MenuBrightnessOverlay(ActiveState.menu, ActiveState.stream_index, Config.streams)
		self.menu_contrast = MenuContrastOverlay(ActiveState.menu, ActiveState.stream_index, Config.streams)
		self.timestamp = TimestampOverlay()
		self.notifications = NotificationsOverlay()

_registry = _Overlays()
name = _registry.name
menu_streams = _registry.menu_streams
menu_brightness = _registry.menu_brightness
menu_contrast = _registry.menu_contrast

def active_stream_status():
	return _registry.stream_status
def active_stream_detections():
	return _registry.stream_detections

timestamp = _registry.timestamp
notifications = _registry.notifications
