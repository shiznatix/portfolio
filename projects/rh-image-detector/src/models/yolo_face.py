import cv2
import numpy as np

import rhpy
from detectors import Detector
from config import YOLOFaceConfig

class YOLOFace(Detector):
	def __init__(self, config: YOLOFaceConfig):
		import torch  # pylint: disable=C0415

		device = 'cuda' if torch.cuda.is_available() else 'cpu'
		self.model = torch.hub.load(
			'ultralytics/yolov5',
			'custom',
			path=config.model_path,
			force_reload=False,
		)
		self.model.to(device) # type: ignore
		self.model.conf = config.threshold # type: ignore

	def detect(self, frame: np.ndarray) -> list[rhpy.DetectionBox]:
		# Convert BGR to RGB
		img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
		results = self.model(img) # type: ignore
		detections: list[rhpy.DetectionBox] = []
		for *xyxy, score, _cls in results.xyxy[0].cpu().numpy():
			x1, y1, x2, y2 = map(int, xyxy)
			detections.append(rhpy.DetectionBox(
				x=x1,
				y=y1,
				w=x2 - x1,
				h=y2 - y1,
				score=float(score),
			))
		return detections
