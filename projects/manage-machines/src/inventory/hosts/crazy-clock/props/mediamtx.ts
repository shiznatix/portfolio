import { MediaMtxProps } from '../../../services/mediamtx';

export default {
	cameras: {
		picam: {
			type: 'picam',
			outWidth: 1296,
			outHeight: 972,
			outFramerate: 10,
			hflip: true,
			cameraCodec: 'hardwareH264',
			bitrate: 1000000, // 1Mbps
		},
		'picam-secondary': {
			type: 'picam',
			secondaryStream: true,
			outWidth: 160,
			outHeight: 128,
			outFramerate: 10,
		},
	},
} as const satisfies MediaMtxProps;
