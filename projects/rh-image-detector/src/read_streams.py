import cv2
import rhpy

from config import ReadStreamsConfig
import detectors
import draw
from stats import ReceiveStats
import streams
import notifiers


class ReadStream:
	def __init__(self, name: str, stream_config: ReadStreamsConfig):
		self.name = name
		self.url = stream_config.url
		self.detector_names = stream_config.detector_names
		self.log = rhpy.logs(f'fstream.{self.name}')
		self.stats = ReceiveStats(self.log)

	def _read_stream(self):
		cap = cv2.VideoCapture(self.url)
		cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
		cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000) # 5s to open
		cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 1000) # 1s per read
		if not cap.isOpened():
			raise RuntimeError('Failed to open stream')

		stream: streams.Stream | None = None
		try:
			self.log.info('Stream opened')
			stream = streams.Manager.add_stream(self.name)
			failure_count = 0
			while rhpy.running():
				ret, frame = cap.read()
				if ret:
					detections = detectors.on_frame(frame, self.detector_names)
					if detections:
						frame = draw.rects(frame.copy(), detections)
						self.stats.detections(len(detections))

					stream.set_frame(frame)
					notifiers.on_frame(self.name, detections)
					self.stats.frame()
					failure_count = 0
				else:
					failure_count += 1
					self.log.dup_error('Failed to read frame')

					if failure_count >= 5:
						raise TimeoutError('Connection timed out after 5 consecutive read failures')
					rhpy.wait(1)
		finally:
			if stream:
				streams.Manager.remove_stream(stream)
			cap.release()
			self.log.info('Stream released')

	def run(self):
		try:
			self.log.info(f'Starting stream follow: {self.url}')
			while rhpy.running():
				try:
					self._read_stream()
				except RuntimeError as e:
					self.log.error(f'Read error: {e}')
				except Exception as e:
					self.log.exception(e)
				finally:
					rhpy.wait(5)
		except Exception as e:
			self.log.exception(e)
			rhpy.quit(error=e)
		finally:
			rhpy.quit()
			self.log.info('Follow stream stopped')
