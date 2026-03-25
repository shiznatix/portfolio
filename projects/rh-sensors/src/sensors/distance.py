from __future__ import annotations
import abc

import rhpy
from sensor import Sensor

class DistanceSensor(Sensor):
	class Stats:
		def __init__(self, parent: DistanceSensor):
			self.parent = parent
			self.reads: int = 0
			self.fail_reads: int = 0
			rhpy.timer(self.parent.name, 5, self.log)
		def log(self, avg_distance, distance):
			if self.parent.log_between_mm_min <= avg_distance <= self.parent.log_between_mm_max:
				self.parent.log.info(
					f'avg_distance:{avg_distance}mm '
					f'distance:{distance}mm, '
					f'reads:{self.reads}, '
					f'fails:{self.fail_reads}'
				)
			self.reads = 0
			self.fail_reads = 0

	log_between_mm_min: int
	log_between_mm_max: int = 999999
	debounce_sec: float = 0.1

	@abc.abstractmethod
	def get_distance_mm(self, *, max_attempts: int = 1, attempt: int = 1) -> int | None:
		pass

	def run(self):
		distance = self.get_distance_mm(max_attempts=10)
		self.log.info('Read initial distance', extra={
			'distance': distance,
		})
		stats = self.Stats(self)
		distances = []
		avg_distance = distance if distance is not None else 0

		while rhpy.running():
			distance = self.get_distance_mm()
			distances.append(distance)
			if len(distances) > 50:
				distances.pop(0)
			int_distances = [d for d in distances if d is not None]
			avg_distance = rhpy.round(sum(int_distances) / len(distances))

			if distance is None:
				stats.fail_reads += 1
				continue
			stats.reads += 1

			(check_distance, key) = (distance, 'current-reading') if distance < avg_distance else (avg_distance, 'average-distance')

			self.log.info(f'"{key}" distance {check_distance}')
			self.send_value(check_distance)
			rhpy.wait(self.debounce_sec)
			distances = []
			avg_distance = 0
