import { RhSensorsProps } from '../../../services/rh-sensors';
import { crazyClock } from '../local';

export default {
	sensors: {
		'crazy-clock-light': {
			module: 'light-digital',
			prometheusTitle: 'clock',
			gpio: 14,
			debounceSec: 3,
			receiverUrls: [crazyClock.url('crayclk', '/light')],
			sendEverySec: 10,
			logIntervalSec: 1,
			// maxRcSecs: 0.03,
			// minRcSecs: 0.01,
			maxRcSecs: 10.0,
			minRcSecs: 0.0,
			percentChangeThreshold: 10,
		},
	},
} as const satisfies RhSensorsProps;
