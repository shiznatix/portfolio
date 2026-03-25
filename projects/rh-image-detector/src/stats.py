import random
import time
import rhpy

def _make_interval(base: float = 10.0, variance: float = 2.0) -> float:
	return base + random.uniform(-variance, variance)

class ReceiveStats:
	def __init__(self, log: rhpy.Logger):
		self.log = log
		self.frame_count = 0
		self.detections_count = 0
		self.log_timer = rhpy.timer('recv.stats', _make_interval(), self.log_stats)
		self.log_time = time.time()
		self.logged_first_frame = False

	def frame(self):
		self.frame_count += 1
		if not self.logged_first_frame and self.frame_count == 1:
			self.log.info('FPS: First frame received')
			self.logged_first_frame = True

	def log_stats(self):
		fps = rhpy.round(self.frame_count / (time.time() - self.log_time))
		self.log.info(f'FPS: {fps}, Detections: {self.detections_count}')
		self.frame_count = 0
		self.detections_count = 0
		self.log_time = time.time()

	def detections(self, count: int):
		self.detections_count += count

class NotifierStats:
	def __init__(self, log: rhpy.Logger):
		self.log = log
		self.http_count = 0
		self.redis_count = 0
		self.detections_count = 0
		self.runs_count = 0
		self.log_timer = rhpy.timer('notif.stats', _make_interval(), self.log_stats)
		self.log_time = time.time()

	def log_stats(self):
		counts = f'detections: {self.detections_count}, http: {self.http_count}, redis: {self.redis_count}, runs: {self.runs_count}'
		self.log.info(f'Publishes: {counts}')
		self.detections_count = 0
		self.http_count = 0
		self.redis_count = 0
		self.runs_count = 0
		self.log_time = time.time()

	def publish(self, *, detections: int = 0, http: int = 0, redis: int = 0):
		self.detections_count += detections
		self.http_count += http
		self.redis_count += redis
		self.runs_count += 1
