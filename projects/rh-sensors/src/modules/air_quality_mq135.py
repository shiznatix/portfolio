import rhpy

from prometheus import gauge_air_quality_value, gauge_air_quality_voltage, counter_air_quality
from sensors.analog_read import AnalogReadSensor
from sensors.event_detection import EventDetectionSensor

###
# MQ-135
# https://www.futurlec.com/Datasheet/Sensor/MQ-135.pdf
# Input voltage = 5V
# Tweak calibration until an analog read of 100-150 in good air
# Don't try to read until the system `uptime` is > 10 minutes to allow the device to heat up
###

#####################
#####################
#####################
#####################
#####################

# adapted from sandboxelectronics.com/?p=165

# from spidev import SpiDev
# import time
# import math

# class MCP3008:
# 	def __init__(self, bus = 0, device = 0):
# 		self.bus, self.device = bus, device
# 		self.spi = SpiDev()
# 		self.open()
# 		self.spi.max_speed_hz = 1000000 # 1MHz

# 	def open(self):
# 		self.spi.open(self.bus, self.device)
# 		self.spi.max_speed_hz = 1000000 # 1MHz

# 	def read(self, channel = 0):
# 		cmd1 = 4 | 2 | (( channel & 4) >> 2)
# 		cmd2 = (channel & 3) << 6

# 		adc = self.spi.xfer2([cmd1, cmd2, 0])
# 		data = ((adc[1] & 15) << 8) + adc[2]
# 		return data

# 	def close(self):
# 		self.spi.close()

# class MQ():

# 	######################### Hardware Related Macros #########################
# 	MQ_PIN					   = 0		# define which analog input channel you are going to use (MCP3008)
# 	RL_VALUE					 = 5		# define the load resistance on the board, in kilo ohms
# 	RO_CLEAN_AIR_FACTOR		  = 9.83	 # RO_CLEAR_AIR_FACTOR=(Sensor resistance in clean air)/RO,
# 											# which is derived from the chart in datasheet

# 	######################### Software Related Macros #########################
# 	CALIBARAION_SAMPLE_TIMES	 = 50	   # define how many samples you are going to take in the calibration phase
# 	CALIBRATION_SAMPLE_INTERVAL  = 500	  # define the time interval(in milisecond) between each samples in the
# 											# cablibration phase
# 	READ_SAMPLE_INTERVAL		 = 50	   # define the time interval(in milisecond) between each samples in
# 	READ_SAMPLE_TIMES			= 5		# define how many samples you are going to take in normal operation
# 											# normal operation

# 	######################### Application Related Macros ######################
# 	GAS_LPG					  = 0
# 	GAS_CO					   = 1
# 	GAS_SMOKE					= 2

# 	def __init__(self, Ro=10, analogPin=0):
# 		self.Ro = Ro
# 		self.MQ_PIN = analogPin
# 		self.adc = MCP3008()

# 		self.LPGCurve = [2.3,0.21,-0.47]	# two points are taken from the curve.
# 											# with these two points, a line is formed which is "approximately equivalent"
# 											# to the original curve.
# 											# data format:{ x, y, slope}; point1: (lg200, 0.21), point2: (lg10000, -0.59)
# 		self.COCurve = [2.3,0.72,-0.34]	 # two points are taken from the curve.
# 											# with these two points, a line is formed which is "approximately equivalent"
# 											# to the original curve.
# 											# data format:[ x, y, slope]; point1: (lg200, 0.72), point2: (lg10000,  0.15)
# 		self.SmokeCurve =[2.3,0.53,-0.44]   # two points are taken from the curve.
# 											# with these two points, a line is formed which is "approximately equivalent"
# 											# to the original curve.
# 											# data format:[ x, y, slope]; point1: (lg200, 0.53), point2: (lg10000,  -0.22)

# 		print("Calibrating...")
# 		self.Ro = self.MQCalibration(self.MQ_PIN)
# 		print("Calibration is done...\n")
# 		print("Ro=%f kohm" % self.Ro)


# 	def MQPercentage(self):
# 		val = {}
# 		read = self.MQRead(self.MQ_PIN)
# 		val["GAS_LPG"]  = self.MQGetGasPercentage(read/self.Ro, self.GAS_LPG)
# 		val["CO"]	   = self.MQGetGasPercentage(read/self.Ro, self.GAS_CO)
# 		val["SMOKE"]	= self.MQGetGasPercentage(read/self.Ro, self.GAS_SMOKE)
# 		return val

# 	######################### MQResistanceCalculation #########################
# 	# Input:   raw_adc - raw value read from adc, which represents the voltage
# 	# Output:  the calculated sensor resistance
# 	# Remarks: The sensor and the load resistor forms a voltage divider. Given the voltage
# 	#		  across the load resistor and its resistance, the resistance of the sensor
# 	#		  could be derived.
# 	############################################################################
# 	def MQResistanceCalculation(self, raw_adc):
# 		return float(self.RL_VALUE*(1023.0-raw_adc)/float(raw_adc));


# 	######################### MQCalibration ####################################
# 	# Input:   mq_pin - analog channel
# 	# Output:  Ro of the sensor
# 	# Remarks: This function assumes that the sensor is in clean air. It use
# 	#		  MQResistanceCalculation to calculates the sensor resistance in clean air
# 	#		  and then divides it with RO_CLEAN_AIR_FACTOR. RO_CLEAN_AIR_FACTOR is about
# 	#		  10, which differs slightly between different sensors.
# 	############################################################################
# 	def MQCalibration(self, mq_pin):
# 		val = 0.0
# 		for i in range(self.CALIBARAION_SAMPLE_TIMES):		  # take multiple samples
# 			val += self.MQResistanceCalculation(self.adc.read(mq_pin))
# 			time.sleep(self.CALIBRATION_SAMPLE_INTERVAL/1000.0)

# 		val = val/self.CALIBARAION_SAMPLE_TIMES				 # calculate the average value

# 		val = val/self.RO_CLEAN_AIR_FACTOR					  # divided by RO_CLEAN_AIR_FACTOR yields the Ro
# 																# according to the chart in the datasheet

# 		return val;


# 	#########################  MQRead ##########################################
# 	# Input:   mq_pin - analog channel
# 	# Output:  Rs of the sensor
# 	# Remarks: This function use MQResistanceCalculation to caculate the sensor resistenc (Rs).
# 	#		  The Rs changes as the sensor is in the different consentration of the target
# 	#		  gas. The sample times and the time interval between samples could be configured
# 	#		  by changing the definition of the macros.
# 	############################################################################
# 	def MQRead(self, mq_pin):
# 		rs = 0.0

# 		for i in range(self.READ_SAMPLE_TIMES):
# 			rs += self.MQResistanceCalculation(self.adc.read(mq_pin))
# 			time.sleep(self.READ_SAMPLE_INTERVAL/1000.0)

# 		rs = rs/self.READ_SAMPLE_TIMES

# 		return rs

# 	#########################  MQGetGasPercentage ##############################
# 	# Input:   rs_ro_ratio - Rs divided by Ro
# 	#		  gas_id	  - target gas type
# 	# Output:  ppm of the target gas
# 	# Remarks: This function passes different curves to the MQGetPercentage function which
# 	#		  calculates the ppm (parts per million) of the target gas.
# 	############################################################################
# 	def MQGetGasPercentage(self, rs_ro_ratio, gas_id):
# 		if ( gas_id == self.GAS_LPG ):
# 			return self.MQGetPercentage(rs_ro_ratio, self.LPGCurve)
# 		elif ( gas_id == self.GAS_CO ):
# 			return self.MQGetPercentage(rs_ro_ratio, self.COCurve)
# 		elif ( gas_id == self.GAS_SMOKE ):
# 			return self.MQGetPercentage(rs_ro_ratio, self.SmokeCurve)
# 		return 0

# 	#########################  MQGetPercentage #################################
# 	# Input:   rs_ro_ratio - Rs divided by Ro
# 	#		  pcurve	  - pointer to the curve of the target gas
# 	# Output:  ppm of the target gas
# 	# Remarks: By using the slope and a point of the line. The x(logarithmic value of ppm)
# 	#		  of the line could be derived if y(rs_ro_ratio) is provided. As it is a
# 	#		  logarithmic coordinate, power of 10 is used to convert the result to non-logarithmic
# 	#		  value.
# 	############################################################################
# 	def MQGetPercentage(self, rs_ro_ratio, pcurve):
# 		return (math.pow(10,( ((math.log(rs_ro_ratio)-pcurve[1])/ pcurve[2]) + pcurve[0])))

#####################
#####################
#####################
#####################
#####################


_MODULE = 'air-quality-mq135'
MODULE_ANALOG = f'{_MODULE}-analog'
MODULE_EVENT_DETECTION = f'{_MODULE}-event-detection'

class SensorAnalog(AnalogReadSensor):
	module: str = MODULE_ANALOG

	warmup_complete: bool = False
	warmup_sec: int = 600  # 10 minutes

	def get_value(self):
		if not self.warmup_complete:
			uptime = rhpy.uptime_sec()
			if uptime < self.warmup_sec:
				self.log.info('Sensor warming up...', extra={'uptime': uptime, 'warmup_sec': self.warmup_sec})
				return None

			self.warmup_complete = True
			self.log.info('Sensor warmup complete', extra={'uptime': uptime, 'warmup_sec': self.warmup_sec})

		value = super().get_value()

		if value is None:
			return None

		self.metric(gauge_air_quality_value).set(value['value'])
		self.metric(gauge_air_quality_voltage).set(value['voltage'])

		return value

class SensorEventDetection(EventDetectionSensor):
	module: str = MODULE_EVENT_DETECTION

	def event_callback(self):
		super().event_callback()
		self.metric(counter_air_quality).inc()
