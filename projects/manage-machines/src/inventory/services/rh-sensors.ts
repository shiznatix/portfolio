import { pythonService } from '../../core/service/service-factory';

type Sensor = ({
	prometheusTitle?: string;
	receiverUrls?: string[];
	quiet?: boolean;
	disabled?: boolean;
} & (
	{
		// HC-SR04 Rangefinder Distance Sensor
		module: 'distance-hcsr04';
		trigGpio: number;
		echoGpio: number;
		logBetweenMmMin?: number;
		logBetweenMmMax?: number;
		logIntervalSec?: number;
		debounceSec?: number;
	}
	| {
		// VL53L0X / VL53L1X Laser Distance Sensor
		module: 'distance-vl53l0x';
		i2cPort?: number;
		logBetweenMmMin?: number;
		logBetweenMmMax?: number;
		logIntervalSec?: number;
		debounceSec?: number;
	}
	| {
		module: 'light-digital';
		gpio: number;
		debounceSec: number;
		maxRcSecs: number;
		minRcSecs: number;
		percentChangeThreshold?: number;
		sendEverySec?: number;
		logIntervalSec?: number;
	}
	| {
		// AM2302 Temperature Sensor Parent
		module: 'thermohygrometer-am2302';
		gpio: number;
		sendEverySec?: number;
		logIntervalSec?: number;
	}
	| {
		// DS18B20 Digital Temperature Sensor
		module: 'temperature-ds18b20';
		deviceIdPrefix?: string;
		sendEverySec?: number;
		logIntervalSec?: number;
	}
	| {
		// BME680 Humidity Temperature Barometer VOC co2 sensor
		module: 'atmosphere-bme680';
		i2cPort?: number;
		sendEverySec?: number;
		logIntervalSec?: number;
	}
	| {
		// INA219 Battery current Sensor
		module: 'battery-ina219';
		maxVoltage?: number;
		minVoltage?: number;
		sendEverySec?: number;
		logIntervalSec?: number;
	}
	| {
		// PAJ7620U2 Gesture Recognition Sensor (9 gestures)
		module: 'gesture-paj7620u2';
		sendEverySec?: number;
		logIntervalSec?: number;
	}
	| {
		// GY-BME280 Barometric Sensor Parent
		module: 'barometric-bme280';
		i2cPort?: number;
		sendEverySec?: number;
		logIntervalSec?: number;
	}
	| {
		// KY-040 Rotary Encoder (turn)
		module: 'rotary-ky040-turn';
		gpioClk: number;
		gpioDt: number;
		maxSteps?: number;
		wrap?: boolean;
		// debounceSec?: number; // the library takes this but it doesn't work at all
	}
	| {
		// Events
		// * SW-420 NC-type Vibration Sensor Module
		// * AM312 Mini Motion Detector Module HC-SR312
		// * HC-SR501 PIR Motion Sensor Module
		// * MQ-135 Gas Sensor (digital event read)
		// * KY-038 Loudness Sensor (digital event read)
		module:
			| 'vibration-sw420'
			| 'motion-am312'
			| 'motion-hcsr501'
			| 'air-quality-mq135-event-detection'
			| 'loudness-ky038-event-detection';
		gpio: number;
		debounceSec: number;
	}
	| {
		// Analog Read
		// * light-analog
		// * Water Drops Sensor
		// * MQ-135 Gas Sensor (analog read)
		// * Aideepen Soil Moisture Module
		// * CQRobot Total Dissolved Solids Sensor
		// * Youmile GUVA S12SD Module UV Sensor
		// * KY-038 Loudness Sensor (analog read)
		// * SEN0170 Wind Speed Sensor
		module:
			| 'light-analog'
			| 'water-drops'
			| 'air-quality-mq135-analog'
			| 'soil-moisture-aideepen'
			| 'total-disolved-solids-cqrobot'
			| 'uv-guvas12sd'
			| 'loudness-ky038-analog'
			| 'wind-speed-sen0170';
		analogPin: number;
		valueDivisor?: number;
		gain?: number;
		sendEverySec?: number;
		logIntervalSec?: number;
		loopSleepSecs?: number;
	}
	| {
		// Buttons
		// * KY-040 Rotary Encoder (press)
		module: 'button' | 'rotary-ky040-press';
		gpio: number;
		debounceSec: number;
		// sendOn?: 'activated' | 'deactivated' | 'both';
		sendEverySec?: number;
		logIntervalSec?: number;
	}
	| {
		// Touch Devices
		module: 'touch-device';
		devicePath: string;
		debounceSec: number;
		deviceWidth?: number;
		deviceHeight?: number;
		inputEventSwapXY?: boolean;
		inputEventMinX?: number;
		inputEventMaxX?: number;
		inputEventInvertX?: boolean;
		inputEventMinY?: number;
		inputEventMaxY?: number;
		inputEventInvertY?: boolean;
		inputEventMinXY?: number;
		inputEventMaxXY?: number;
		tapMaxDistance?: number;
		longPressMinSec?: number;
		swipeMinDistance?: number;
		swipeMinSec?: number;
		swipeMaxSec?: number;
	}
));

export type RhSensorsProps = {
	sensors: Record<string, Sensor>;
	noI2c?: boolean;
	noOneWire?: boolean;
	ports?: {
		http?: number;
	};
};

export default pythonService<RhSensorsProps>()({
	name: 'rh-sensors',
	serviceTemplate: 'service',
	configJson: true,
	unitExecSudo: true,
	pythonSystemSitePackages: true,
	aptDependencies: [
		'python3-lgpio',
	],
	ports: {
		http: 8034,
	},
})(Base => class extends Base {
	piInterfaces = [
		!this.props.noI2c && 'i2c',
		!this.props.noOneWire && 'onewire',
	].filter(i => i) as string[];
});
