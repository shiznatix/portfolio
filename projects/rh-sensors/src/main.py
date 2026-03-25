from typing import Type
from gpiozero import Device
from gpiozero.pins.lgpio import LGPIOFactory

import rhpy.web

from sensor import Sensor
from modules import (
	air_quality_mq135, atmosphere_bme680,
	barometric_bme280, battery_ina219, button,
	distance_vl53l0x, gesture_paj7620u2,
	light_analog, light_digital, loudness_ky038,
	motion_am312, motion_hcsr501,
	rotary_ky040, soil_moisture_aideepen,
	temperature_ds18b20, thermohygrometer_am2302, total_disolved_solids_cqrobot, touch_device,
	uv_guvas12sd, vibration_sw420,
	water_drops, wind_speed_sen0170
)
from config import Config, SensorConfig

Device.pin_factory = LGPIOFactory()

log = rhpy.logs('main')

def sensor(conf: SensorConfig, model: Type[Sensor]):
	log.info(f'Initializing sensor {conf.name} of type {conf.module}')
	s: Sensor = model.model_validate(conf.model_dump())
	rhpy.thread(s.init_and_run, name=conf.name, start=False)

def init_sensors():
	for name, conf in Config.sensors.items():
		if conf.disabled:
			log.info(f'Sensor {name} is disabled, skipping initialization')
			continue

		if conf.module == air_quality_mq135.MODULE_ANALOG:
			sensor(conf, air_quality_mq135.SensorAnalog)
		elif conf.module == air_quality_mq135.MODULE_EVENT_DETECTION:
			sensor(conf, air_quality_mq135.SensorEventDetection)
		elif conf.module == atmosphere_bme680.MODULE:
			sensor(conf, atmosphere_bme680.Sensor)
		elif conf.module == barometric_bme280.MODULE:
			sensor(conf, barometric_bme280.Sensor)
		elif conf.module == battery_ina219.MODULE:
			sensor(conf, battery_ina219.Sensor)
		elif conf.module == button.MODULE:
			sensor(conf, button.Sensor)
		# elif conf.module == distance_hcsr04.MODULE:
		#     sensor(conf, distance_hcsr04.Sensor)
		elif conf.module == distance_vl53l0x.MODULE:
			sensor(conf, distance_vl53l0x.Sensor)
		elif conf.module == gesture_paj7620u2.MODULE:
			sensor(conf, gesture_paj7620u2.Sensor)
		elif conf.module == light_analog.MODULE:
			sensor(conf, light_analog.Sensor)
		elif conf.module == light_digital.MODULE:
			sensor(conf, light_digital.Sensor)
		elif conf.module == loudness_ky038.MODULE_ANALOG:
			sensor(conf, loudness_ky038.SensorAnalog)
		elif conf.module == loudness_ky038.MODULE_EVENT_DETECTION:
			sensor(conf, loudness_ky038.SensorEventDetection)
		elif conf.module == motion_am312.MODULE:
			sensor(conf, motion_am312.Sensor)
		elif conf.module == motion_hcsr501.MODULE:
			sensor(conf, motion_hcsr501.Sensor)
		elif conf.module == rotary_ky040.MODULE_TURN:
			sensor(conf, rotary_ky040.SensorTurn)
		elif conf.module == rotary_ky040.MODULE_PRESS:
			sensor(conf, rotary_ky040.SensorPress)
		elif conf.module == soil_moisture_aideepen.MODULE:
			sensor(conf, soil_moisture_aideepen.Sensor)
		elif conf.module == temperature_ds18b20.MODULE:
			sensor(conf, temperature_ds18b20.Sensor)
		elif conf.module == thermohygrometer_am2302.MODULE:
			sensor(conf, thermohygrometer_am2302.Sensor)
		elif conf.module == total_disolved_solids_cqrobot.MODULE:
			sensor(conf, total_disolved_solids_cqrobot.Sensor)
		elif conf.module == touch_device.MODULE:
			sensor(conf, touch_device.Sensor)
		elif conf.module == uv_guvas12sd.MODULE:
			sensor(conf, uv_guvas12sd.Sensor)
		elif conf.module == vibration_sw420.MODULE:
			sensor(conf, vibration_sw420.Sensor)
		elif conf.module == water_drops.MODULE:
			sensor(conf, water_drops.Sensor)
		elif conf.module == wind_speed_sen0170.MODULE:
			sensor(conf, wind_speed_sen0170.Sensor)
		else:
			raise ValueError(f'Unknown sensor type: {conf.module}')

	log.info(f'Initialized {len(Config.sensors)} sensors')

if __name__ == '__main__':
	rhpy.web.run(Config, init=init_sensors)
