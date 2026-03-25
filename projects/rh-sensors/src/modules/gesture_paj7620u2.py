import smbus
import rhpy
from sensors.loop import LoopSensor

MODULE = 'gesture-paj7620u2'

# taken from https://www.yahboom.net/xiazai/module/Gesture/PAJ7620U2.py
# I2C_ADDRESS = 0x73
# Register Bank Selection
# BANK_SELECT = 0xEF # Bank0== 0x00,Bank1== 0x01
# Register Bank 0
# SUSPEND = 0x03 #I2C suspend command (write= 0x01Enter the suspended state)
# INT_FLAG1_MASK = 0x41 # Gesture detection interrupt flag mask
# INT_FLAG2_MASK = 0x42 # Gesture /PS detects interrupt flag mask
# INT_FLAG1 = 0x43 # Gesture detects interrupt flags
# INT_FLAG2 = 0x44 # Gesture /PS detects interrupt flags
# STATE = 0x45 # Gesture detection status indicator (only in gesture detection mode)
# PS_HIGH_THRESHOLD = 0x69 # PS hysteresis high threshold (only in proximity detection mode)
# PS_LOW_THRESHOLD = 0x6A # PS hysteretic low threshold (only effective in proximity detection mode)
# PS_APPROACH_STATE = 0x6B # PS approaching state, approaching = 1
# PS_DATA = 0x6C # PS 8-bit data (valid only in gesture detection mode)
# OBJ_BRIGHTNESS = 0xB0 # Object brightness (maximum 255)
# OBJ_SIZE_L = 0xB1 # Object size (low 8 bits)
# OBJ_SIZE_H = 0xB2 # Object size (high 8 bits)
# Register Bank 1
# PS_GAIN = 0x44 # PS Gain setting (only available in proximity detection mode)
# IDLE_S1_STEP_L = 0x67 # Idle S1 step size, used to set S1, response coefficient (low 8 bits)
# IDLE_S1_STEP_H = 0x68 # Idle S1 step size, used to set S1, response coefficient (high 8 bits)
# IDLE_S2_STEP_L = 0x69 # Free S2 step size for setting S2, response factor (low 8 bits)
# IDLE_S2_STEP_H = 0x6A # Free S2 step size, used to set S2, response factor (high 8 bits)
# OPTOS1_TIME_L = 0x6B # OPtoS1 Step The OPtoS1 time used to set the operation state to standby 1 (low 8 bits)
# OPTOS2_TIME_H = 0x6C # OPtoS1 Step Use to set OPtoS1 runtime to standby 1 stateHigh 8 bits)
# S1TOS2_TIME_L = 0x6D # S1toS2 step S1toS2 time used to set standby state 1to standby state 2 (low 8 bits)
# S1TOS2_TIME_H = 0x6E # S1toS2 step Set the S1toS2 time in standby 1to 8 bits higher in standby 2)
# EN = 0x72 # Enable/Disable PAJ7620U2

I2C_ADDRESS = 0x73
BANK_SELECT = 0xEF # Bank0== 0x00,Bank1== 0x01
INT_FLAG1 = 0x43 # Gesture detects interrupt flags
GESTURE_RIGHT = 0x01
GESTURE_LEFT = 0x02
GESTURE_UP = 0x04
GESTURE_DOWN = 0x08
GESTURE_FORWARD = 0x10
GESTURE_BACKWARD = 0x20
GESTURE_CLOCKWISE = 0x40
GESTURE_COUNTER_CLOCKWISE = 0x80
GESTURE_WAVE = 0x100

# Start up Init array
INIT_REGISTER_ARRAY = [
	(0xEF, 0x00), (0x37, 0x07), (0x38, 0x17), (0x39, 0x06), (0x41, 0x00),
	(0x42, 0x00), (0x46, 0x2D), (0x47, 0x0F), (0x48, 0x3C), (0x49, 0x00),
	(0x4A, 0x1E), (0x4C, 0x20), (0x51, 0x10), (0x5E, 0x10), (0x60, 0x27),
	(0x80, 0x42), (0x81, 0x44), (0x82, 0x04), (0x8B, 0x01), (0x90, 0x06),
	(0x95, 0x0A), (0x96, 0x0C), (0x97, 0x05), (0x9A, 0x14), (0x9C, 0x3F),
	(0xA5, 0x19), (0xCC, 0x19), (0xCD, 0x0B), (0xCE, 0x13), (0xCF, 0x64),
	(0xD0, 0x21), (0xEF, 0x01), (0x02, 0x0F), (0x03, 0x10), (0x04, 0x02),
	(0x25, 0x01), (0x27, 0x39), (0x28, 0x7F), (0x29, 0x08), (0x3E, 0xFF),
	(0x5E, 0x3D), (0x65, 0x96), (0x67, 0x97), (0x69, 0xCD), (0x6A, 0x01),
	(0x6D, 0x2C), (0x6E, 0x01), (0x72, 0x01), (0x73, 0x35), (0x74, 0x00),
	(0x77, 0x01),
]

# Gesture register init array
INIT_GESTURE_ARRAY = [
	(0xEF, 0x00), (0x41, 0x00), (0x42, 0x00), (0xEF, 0x00), (0x48, 0x3C),
	(0x49, 0x00), (0x51, 0x10), (0x83, 0x20), (0x9F, 0xF9), (0xEF, 0x01),
	(0x01, 0x1E), (0x02, 0x0F), (0x03, 0x10), (0x04, 0x02), (0x41, 0x40),
	(0x43, 0x30), (0x65, 0x96), (0x66, 0x00), (0x67, 0x97), (0x68, 0x01),
	(0x69, 0xCD), (0x6A, 0x01), (0x6B, 0xB0), (0x6C, 0x04), (0x6D, 0x2C),
	(0x6E, 0x01), (0x74, 0x00), (0xEF, 0x00), (0x41, 0xFF), (0x42, 0x01),
]

class Sensor(LoopSensor):
	module: str = MODULE
	_bus: smbus.SMBus

	def init_sensor(self):
		self._bus = smbus.SMBus(1)
		rhpy.wait(0.5)

		if self._bus.read_byte_data(I2C_ADDRESS, 0x00) != 0x20:
			raise Exception('Sensor not found')

		for val in INIT_REGISTER_ARRAY:
				self._bus.write_byte_data(I2C_ADDRESS, val[0], val[1])

		self._bus.write_byte_data(I2C_ADDRESS, BANK_SELECT, 0)

		for val in INIT_GESTURE_ARRAY:
			self._bus.write_byte_data(I2C_ADDRESS, val[0], val[1])

	def get_value(self):
		lsb = self._bus.read_byte_data(I2C_ADDRESS, INT_FLAG1)
		msb = self._bus.read_byte_data(I2C_ADDRESS, INT_FLAG1 + 1)

		gesture = (msb << 8) + lsb

		if gesture == GESTURE_RIGHT:
			self.log.info('Right')
		elif gesture == GESTURE_LEFT:
			self.log.info('Left')
		elif gesture == GESTURE_UP:
			self.log.info('Up')
		elif gesture == GESTURE_DOWN:
			self.log.info('Down')
		elif gesture == GESTURE_FORWARD:
			self.log.info('Forward')
		elif gesture == GESTURE_BACKWARD:
			self.log.info('Backward')
		elif gesture == GESTURE_CLOCKWISE:
			self.log.info('Clockwise')
		elif gesture == GESTURE_COUNTER_CLOCKWISE:
			self.log.info('Counter Clockwise')
		elif gesture == GESTURE_WAVE:
			self.log.info('Wave')
		else:
			return
		return gesture

	def run(self):
		while rhpy.running():
			value = self.get_value()
			if value:
				self.send_value(value)

			rhpy.wait(0.05)
