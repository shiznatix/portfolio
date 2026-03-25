from sensors.loop import LoopSensor

class BatterySensor(LoopSensor):
	max_voltage: float = 4.0
	min_voltage: float = 3.3
