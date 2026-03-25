# import time

# import RPi.GPIO as GPIO

# from sensor import DistanceSensor

# MODULE = 'distance-hcsr04'

# class Config(DistanceSensor):
# 	def __init__(self, *, conf: dict, quit_event: mp.Event):
# 		super().__init__(conf=conf, quit_event=quit_event)
# 		self.trig_gpio: int = conf.get('trigGpio', 0)
# 		self.echo_gpio: int = conf.get('echoGpio', 0)

# class Sensor(Config):
# 	def __init__(
# 			self,
# 			*,
# 			conf: dict,
# 			quit_event: mp.Event,
# 		):
# 		super().__init__(
# 			conf=conf,
# 			quit_event=quit_event,
# 		)

# 		GPIO.setup(self.trig_gpio, GPIO.OUT)
# 		GPIO.setup(self.echo_gpio, GPIO.IN)
# 		GPIO.output(self.trig_gpio, GPIO.LOW)

# 	def get_distance_mm(self, *, max_attempts = 1, attempt = 1) -> int | None:
# 		if attempt > 1:
# 			self.log.info(f'Attempt {attempt}of{max_attempts} to get distance')

# 		def recursive_get_distance() -> int | None:
# 			return self.get_distance_mm(max_attempts=max_attempts, attempt=attempt + 1) if attempt < max_attempts else None

# 		GPIO.output(self.trig_gpio, GPIO.HIGH)
# 		rhpy.wait(0.00001)
# 		GPIO.output(self.trig_gpio, GPIO.LOW)
# 		pulse_start = None
# 		pulse_end = None
# 		max_i = 30000 # roughly 0.5 seconds

# 		i = 0
# 		while not GPIO.input(self.echo_gpio):
# 			pulse_start = time.time()
# 			i += 1
# 			if i == max_i:
# 				return recursive_get_distance()

# 		i = 0
# 		while GPIO.input(self.echo_gpio):
# 			pulse_end = time.time()
# 			i += 1
# 			if i == max_i:
# 				return recursive_get_distance()

# 		if pulse_start is None or pulse_end is None:
# 			return recursive_get_distance()

# 		pulse_duration = pulse_end - pulse_start
# 		distance_mm = round(pulse_duration * 17150 * 10) # 17150 is the speed of sound in cm/s, 10 is to convert cm to mm

# 		return distance_mm if distance_mm > 0 else None

# 	def run(self):
# 		try:
# 			super().run()
# 		finally:
# 			GPIO.output(self.trig_gpio, GPIO.LOW)
