from abc import ABC, abstractmethod
from typing import cast

import cv2
import numpy as np
import rhpy

from config import Config, MediaPipeObjectronConfig, ModelName


log = rhpy.logs('detectors')

class Detector(ABC):
	@abstractmethod
	def detect(self, frame) -> list[rhpy.DetectionBox]: ...

# drop overlapping detections. smaller `iou_threshold` means more aggressive dropping
def nms(detections: list[rhpy.DetectionBox], iou_threshold: float = 0.5) -> list[rhpy.DetectionBox]:
	if len(detections) <= 1:
		return detections
	boxes = [[d.x, d.y, d.w, d.h] for d in detections]
	scores = [d.score for d in detections]
	indices = cv2.dnn.NMSBoxes(boxes, scores, score_threshold=0.0, nms_threshold=iou_threshold)
	return [detections[i] for i in indices]

class _Detectors:
	_models: dict[str, Detector] = {}

	def init(self):
		import models # pylint: disable=C0415

		for model in Config.models:
			if model.name == 'mediapipe.face':
				self._models[model.name] = models.MediaPipeFace(model)
			elif model.name in ['mediapipe.shoe', 'mediapipe.chair', 'mediapipe.cup', 'mediapipe.camera']:
				self._models[model.name] = models.MediaPipeObjectron(cast(MediaPipeObjectronConfig, model))
			elif model.name == 'yolo.face':
				self._models[model.name] = models.YOLOFace(model)
			elif model.name == 'blazeface':
				self._models[model.name] = models.BlazeFace(model)

	def on_frame(self, frame: np.ndarray, detector_names: list[ModelName]) -> list[rhpy.DetectionBox]:
		all_detections: list[rhpy.DetectionBox] = []

		for detector_name in detector_names:
			try:
				pkg = self._models.get(detector_name)
				if pkg is None:
					raise ValueError(f'Detector {detector_name!r} is not implemented')

				detections = nms(pkg.detect(frame))
				all_detections.extend(detections)
			except Exception as e:
				log.dup_error(str(e))
		return all_detections
detectors = _Detectors()
def init():
	return detectors.init()
def on_frame(frame: np.ndarray, detector_names: list[ModelName]) -> list[rhpy.DetectionBox]:
	return detectors.on_frame(frame, detector_names)
