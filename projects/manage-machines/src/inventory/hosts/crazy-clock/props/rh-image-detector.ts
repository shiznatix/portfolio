import { RhImageDetectorProps } from '../../../services/rh-image-detector';
import { crazyClock } from '../local';

export default {
	models: [
		{ name: 'mediapipe.face', modelSelection: 'short-range' },
	],
	notifiers: {
		clock: [
			{
				debounceSec: 5,
				receiverUrls: [crazyClock.url('crayclk', '/faces')],
			},
			{
				debounceSec: 0.2,
				receiverUrls: [crazyClock.url('redis')],
			},
		],
	},
	readStreams: {
		clock: {
			url: crazyClock.mediamtxUrl('picam-secondary'),
			detectorNames: ['mediapipe.face'],
		},
	},
} as const satisfies RhImageDetectorProps;
