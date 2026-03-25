import threading

import rhpy


class _Brightness:
	_val = 1.0
	log = rhpy.logs('state.brightness')

	@property
	def val(self) -> float:
		return self._val
	@val.setter
	def val(self, value: float):
		if value < 0:
			self.log.warning(f'Invalid brightness value: {value}')
			value = 0
		if value != self._val:
			self.log.info(f'Brightness changed to {value}')
		self._val = value

class _FaceDetections:
	_val = False
	log = rhpy.logs('state.detections')
	expire_timer: threading.Timer | None = None
	lock = threading.RLock()

	@property
	def val(self) -> bool:
		return self._val
	@val.setter
	def val(self, value: bool):
		with self.lock:
			if self.expire_timer:
				self.expire_timer.cancel()
				self.expire_timer = None

			self._set_and_log(value)

			if value:
				self.expire_timer = threading.Timer(5.0, lambda: self._set_and_log(False))
				self.expire_timer.start()

	def _set_and_log(self, value: bool):
		if value != self._val:
			self.log.info(f'Detections changed to {value}')
		self._val = value

class State:
	_brightness = _Brightness()
	_detections = _FaceDetections()

	@staticmethod
	def brightness() -> float:
		return State._brightness.val
	@staticmethod
	def set_brightness(value: float) -> None:
		State._brightness.val = value

	@staticmethod
	def detections() -> bool:
		return State._detections.val
	@staticmethod
	def set_detections(value: bool) -> None:
		State._detections.val = value
