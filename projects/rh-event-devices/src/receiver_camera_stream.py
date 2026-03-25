from enum import Enum
import collections
import threading
import time
import os
import pwd
import glob
from typing import Literal

import cv2

import rhpy
from receiver import Receiver
import status_reporter
from config import CameraStreamConfig

class CameraStream(CameraStreamConfig, Receiver):
	class RecordingEvent(Enum):
		START = 'start'
		EXTEND = 'extend'
		STOP = 'stop'

	class RecordStats:
		def __init__(self):
			self.start_time = 0.0
			self.end_time = 0.0
			self.pre_buffer_len = 0
			self.post_buffer_len = 0
			self.frame_images_len = 0

		def __str__(self):
			total_time = round(self.end_time - self.start_time, 1)
			return (
				f'Stats(total_time={total_time}, '
				f'pre_buffer_len={self.pre_buffer_len}, '
				f'post_buffer_len={self.post_buffer_len}, '
				f'frame_images_len={self.frame_images_len})'
			)

	type: Literal['camera'] = 'camera'
	_pre_buffer: collections.deque = collections.deque()
	_frozen_pre_buffer: list = []
	_post_buffer: collections.deque = collections.deque()
	_buffer_lock: threading.RLock = threading.RLock()
	_recording: bool = False
	_recording_timer: threading.Timer | None = None
	_recording_lock: threading.RLock = threading.RLock()
	_recording_path_prefix: str | None = None
	_record_stats: RecordStats = RecordStats()
	_cap: cv2.VideoCapture | None = None
	_cleanup_thread: threading.Thread | None = None

	def init_receiver(self):
		pass

	def _send_status(self, status: RecordingEvent):
		status_reporter.send(f'camera.recording.{self.name}', status.value, self.receiver_urls)

	def _create_capture(self):
		cap = cv2.VideoCapture(self.rtsp_url)
		cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
		return cap

	def _start_recording(self):
		with self._recording_lock:
			self._record_stats = CameraStream.RecordStats()
			self._record_stats.start_time = time.time()
			self._recording = True
			self._recording_path_prefix = f'{self.recordings_path}/{time.strftime("%y-%m-%d_%H-%M-%S")}'
			with self._buffer_lock:
				self._frozen_pre_buffer = [frame for ts, frame in self._pre_buffer]
				self._post_buffer.clear()
		self._reset_recording_timer()
		self._send_status(self.RecordingEvent.START)
		self.log.info(f'Started recording to {self._recording_path_prefix} with {len(self._frozen_pre_buffer)} frames in pre-buffer')

	def _reset_recording_timer(self):
		with self._recording_lock:
			if self._recording_timer and self._recording_timer.is_alive():
				self._recording_timer.cancel()
			self._recording_timer = threading.Timer(self.record_secs, self._stop_recording)
			self._recording_timer.start()
		self._send_status(self.RecordingEvent.EXTEND)

	def _stop_recording(self):
		with self._recording_lock:
			self._record_stats.end_time = time.time()
			if not self._recording:
				return
			self._recording = False
			path_prefix = str(self._recording_path_prefix)
			with self._buffer_lock:
				# Insert 1 second of blank frames between pre and post buffers
				blank_frames = []
				if self._frozen_pre_buffer:
					height, width = self._frozen_pre_buffer[0].shape[:2]
					blank_frame = (self._frozen_pre_buffer[0] * 0).astype(self._frozen_pre_buffer[0].dtype)
					blank_frames = [blank_frame] * self.framerate
				frames = self._frozen_pre_buffer + blank_frames + [frame for ts, frame in self._post_buffer]
				# For extracting frames, keep timestamps for non-blank frames
				pre_timestamps = [ts for ts, frame in self._pre_buffer]
				post_timestamps = [ts for ts, frame in self._post_buffer]
				self._record_stats.pre_buffer_len = len(self._frozen_pre_buffer)
				self._record_stats.post_buffer_len = len(self._post_buffer)
				self._pre_buffer.clear()
				self._post_buffer.clear()
			if frames:
				height, width = frames[0].shape[:2]
				# Always save mp4
				fourcc = cv2.VideoWriter_fourcc(*'mp4v')
				out = cv2.VideoWriter(f'{path_prefix}.mp4', fourcc, self.framerate, (width, height))
				for frame in frames:
					out.write(frame)
				out.release()
				# extract frames if requested
				if self.extract_frames:
					os.makedirs(path_prefix, exist_ok=True)
					self._set_owner(path_prefix)
					# Combine timestamps for pre and post buffers, skip blank frames
					all_frames = (
						[(ts, frame) for ts, frame in zip(pre_timestamps, self._frozen_pre_buffer)] +
						[(None, frame) for frame in blank_frames] +
						[(ts, frame) for ts, frame in zip(post_timestamps, [frame for ts, frame in self._post_buffer])]
					)
					self._record_stats.frame_images_len = 0
					for i, (ts, frame) in enumerate(all_frames):
						if ts is None:
							continue  # skip blank frames
						jpg_path = os.path.join(f'{path_prefix}/', f'{i}.jpg')
						cv2.imwrite(jpg_path, frame)
						self._set_owner(jpg_path)
						self._record_stats.frame_images_len += 1
			self.log.info(f'Stopped recording to {path_prefix}')
			self._set_owner(f'{path_prefix}.mp4')
			self._recording_path_prefix = None
			self._frozen_pre_buffer = []
		self.log.info(f'Recording stats: {self._record_stats}')
		self._send_status(self.RecordingEvent.STOP)

	def _set_owner(self, path: str):
		if self.recordings_owner:
			try:
				pw_record = pwd.getpwnam(self.recordings_owner)
				os.chown(path, pw_record.pw_uid, pw_record.pw_gid)
				os.chmod(path, 0o755 if os.path.isdir(path) else 0o664)
				self.log.debug(f'Changed ownership of {path} to {self.recordings_owner}')
			except Exception as e:
				self.log.error(f'Failed to chown {path} to {self.recordings_owner}: {e}')

	def _rm_old_recordings(self):
		if not self.recordings_max_age_secs or self.recordings_max_age_secs < 1:
			return

		while rhpy.running():
			try:
				now = time.time()
				for path in glob.glob(os.path.join(self.recordings_path, '*.mp4')):
					if not rhpy.running():
						return

					try:
						filename = os.path.basename(path)
						mtime = int(os.path.getmtime(path))
						age_secs = now - mtime
						if age_secs > self.recordings_max_age_secs:
							os.remove(path)
							self.log.info(f'Deleted old recording:{filename} mtime:{mtime} age:{age_secs}secs')
						else:
							self.log.debug(f'Keeping recording:{filename} mtime:{mtime} age:{age_secs}secs')
					except Exception as e:
						self.log.error(f'Error deleting {path}: {e}')
			except Exception as e:
				self.log.error(f'Error during cleanup: {e}')

			rhpy.wait(60 * 10) # 10 min

	def receive(self, data):
		with self._recording_lock:
			if not self.get_first_match(data):
				return False

			if self._recording:
				self._reset_recording_timer()
			else:
				self._start_recording()
		return True

	def run(self):
		self.log.info('Starting main function')

		# setup recordings dir
		if not os.path.exists(self.recordings_path):
			path = self.recordings_path
			parts = os.path.abspath(path).split(os.sep)
			for i in range(1, len(parts) + 1):
				dir_path = os.sep.join(parts[:i]) or os.sep
				if not os.path.isdir(dir_path):
					os.mkdir(dir_path)
					self._set_owner(dir_path)
					self.log.info(f'Created recordings dir part: {dir_path}')

		self._cleanup_thread = threading.Thread(target=self._rm_old_recordings, daemon=True)
		self._cleanup_thread.start()
		self._cap = self._create_capture()

		frame_count = 0
		fps_log_interval = 10  # seconds
		last_fps_log_time = time.time()

		while rhpy.running():
			ret, frame = (self._cap.read() if self._cap.isOpened() else (False, None))
			now = time.time()
			if not ret:
				self.log.error(f'Failed to read RTSP stream: {self.rtsp_url}')
				self._stop_recording()
				self._cap = self._create_capture()
				rhpy.wait(5)
				continue
			frame_count += 1
			with self._buffer_lock:
				if self._recording:
					self._post_buffer.append((now, frame))
					# Remove frames older than record_secs from post_buffer
					while self._post_buffer and now - self._post_buffer[0][0] > self.record_secs:
						self._post_buffer.popleft()
				else:
					self._pre_buffer.append((now, frame))
					# Remove frames older than buffer_secs from pre_buffer
					while self._pre_buffer and now - self._pre_buffer[0][0] > self.buffer_secs:
						self._pre_buffer.popleft()
			# Log FPS every 10 seconds
			if now - last_fps_log_time >= fps_log_interval:
				fps = frame_count / (now - last_fps_log_time)
				self.log.info(f'Processed FPS: {fps:.2f}')
				frame_count = 0
				last_fps_log_time = now

	def cleanup(self):
		self._stop_recording()
		if self._cap:
			self._cap.release()
		if self._cleanup_thread:
			self._cleanup_thread.join(1)
