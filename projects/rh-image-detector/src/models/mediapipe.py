from abc import ABC, abstractmethod
from typing import NamedTuple

import numpy as np

import rhpy
from detectors import Detector
from config import MediaPipeFaceConfig, MediaPipeObjectronConfig


class _MediaPipe(Detector, ABC):
	def __init__(self, model_name: str, detector):
		self.model_name = model_name
		self.log = rhpy.logs(f'mp.{model_name}')
		self.log.info(f'Loading MediaPipe {model_name} model')

		self.detector = detector
		rhpy.on_quit(self.detector.close)

		self.log.info(f'MediaPipe {model_name} model loaded')

	@abstractmethod
	def _detect(self, frame: np.ndarray) -> NamedTuple:
		...

	def detect(self, frame: np.ndarray) -> list[rhpy.DetectionBox]:
		detections = self._detect(frame)

		boxes: list[rhpy.DetectionBox] = []
		if detections:
			ih, iw, _ = frame.shape
			for detection in detections:
				# bbox = detection.bounding_box
				bbox = detection.location_data.relative_bounding_box
				boxes.append(rhpy.DetectionBox(
					x=int(bbox.xmin * iw),
					y=int(bbox.ymin * ih),
					w=int(bbox.width * iw),
					h=int(bbox.height * ih),
					score=detection.score[0],
				))
		return boxes

class MediaPipeFace(_MediaPipe):
	def __init__(self, config: MediaPipeFaceConfig):
		model_selection = 0 if config.model_selection == 'short-range' else 1
		import mediapipe  # pylint: disable=C0415
		super().__init__('face', mediapipe.solutions.face_detection.FaceDetection(  # type: ignore
			model_selection=model_selection,
			min_detection_confidence=config.detection_threshold,
		))

	def _detect(self, frame: np.ndarray) -> NamedTuple:
		results = self.detector.process(frame)
		return results.detections

class MediaPipeObjectron(_MediaPipe):
	def __init__(self, config: MediaPipeObjectronConfig):
		model_name = config.name.split('.')[1].capitalize()  # mediapipe.shoe -> Shoe
		import mediapipe  # pylint: disable=C0415
		super().__init__(model_name, mediapipe.solutions.objectron.Objectron(  # type: ignore
			static_image_mode=False,
			max_num_objects=config.max_num_objects,
			min_detection_confidence=config.detection_threshold,
			min_tracking_confidence=config.tracking_threshold,
			model_name=model_name,
		))

	def _detect(self, frame: np.ndarray) -> NamedTuple:
		results = self.detector.process(frame)
		return results.detected_objects
