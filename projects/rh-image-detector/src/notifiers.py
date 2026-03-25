import time

from requests.adapters import ConnectTimeoutError, MaxRetryError

import rhpy

from config import Config, NotifierConfig
from stats import NotifierStats


class _Notifier:
	def __init__(self, name: str, notify_config: NotifierConfig):
		self.log = rhpy.logs(f'notif.{name}')
		self.redis_log = rhpy.logs(f'notif.{name}.redis', rhpy.WARNING)
		self.name = name
		self.debounce_sec = notify_config.debounce_sec
		self.receiver_urls = notify_config.receiver_urls
		self.last_publish_time = 0
		self.last_publish_count = 0
		self.stats = NotifierStats(self.log)

	def on_http_error(self, url: str, error: Exception):
		if isinstance(error, (MaxRetryError, ConnectTimeoutError)):
			self.log.dup_error(f'HTTP notification host offline {url}', interval=60)
		else:
			self.log.error(f'Failed to send HTTP notification to {url}: {error}')

	def on_redis_error(self, url: str, error: Exception):
		self.redis_log.dup_error(f'Failed to send Redis notification to {url}: {error}')

	def publish(self, detections: list[rhpy.DetectionBox]):
		now = time.time()
		publish = now - self.last_publish_time >= self.debounce_sec
		# if we didn't have detections before, but we do now
		publish = publish or (detections and self.last_publish_count == 0)
		if not publish:
			return

		body = {
			'timestamp': round(now),
			'detections': [d.model_dump() for d in detections]
		}

		counts = rhpy.publish(
			self.name, self.receiver_urls,
			body=body,
			on_http_error=self.on_http_error,
			on_redis_error=self.on_redis_error,
			quiet=True,
		)
		detections_count = len(detections)
		self.last_publish_time = time.time()
		self.last_publish_count = detections_count
		self.stats.publish(detections=detections_count, http=counts.http, redis=counts.redis)

class _Notifiers:
	_notifiers: dict[str, list[_Notifier]] = {}

	def __init__(self):
		for name, configs in Config.notifiers.items():
			self._notifiers[name] = [_Notifier(name, cfg) for cfg in configs]

	def on_frame(self, stream_name: str, detections: list[rhpy.DetectionBox]):
		notifs = self._notifiers.get(stream_name, [])
		for notif in notifs:
			notif.publish(detections)
notifiers = _Notifiers()
def on_frame(stream_name: str, detections: list[rhpy.DetectionBox]):
	notifiers.on_frame(stream_name, detections)
