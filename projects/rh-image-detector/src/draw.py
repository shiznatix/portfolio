import cv2
import numpy as np

import rhpy

def rects(frame: np.ndarray, detections: list[rhpy.DetectionBox]):
	for d in detections:
		cv2.rectangle(frame, (d.x, d.y), (d.x + d.w, d.y + d.h), (0, 255, 0), 2)
		cv2.putText(frame, f'{d.score}', (d.x, d.y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
	return frame
