import cv2
import numpy as np

import rhpy
from detectors import Detector
from config import BlazeFaceConfig

class BlazeFace(Detector):
	def __init__(self, config: BlazeFaceConfig):
		import tflite_runtime.interpreter as tflite  # pylint: disable=C0415

		self.config = config
		self.interpreter = tflite.Interpreter(model_path=self.config.model_path)
		self.interpreter.allocate_tensors()
		self.input_details = self.interpreter.get_input_details()
		self.output_details = self.interpreter.get_output_details()

	def detect(self, frame: np.ndarray) -> list[rhpy.DetectionBox]:
		# Resize and normalize frame
		img = cv2.resize(frame, (self.config.width, self.config.height))
		img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
		img = img.astype(np.float32) / 255.0
		img = np.expand_dims(img, axis=0)
		self.interpreter.set_tensor(self.input_details[0]['index'], img)
		self.interpreter.invoke()
		# Get outputs (assumes BlazeFace TFLite output format)
		boxes = self.interpreter.get_tensor(self.output_details[0]['index'])[0]
		scores = self.interpreter.get_tensor(self.output_details[1]['index'])[0]
		detections: list[rhpy.DetectionBox] = []
		for i, score in enumerate(scores):
			if score > self.config.threshold:
				y_min, x_min, y_max, x_max = boxes[i]
				h, w, _ = frame.shape
				detections.append(rhpy.DetectionBox(
					x=int(x_min * w),
					y=int(y_min * h),
					w=int(x_max * w),
					h=int(y_max * h),
					score=float(score),
				))
		return detections
