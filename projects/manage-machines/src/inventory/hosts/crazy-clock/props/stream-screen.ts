import { Type } from '@sinclair/typebox';
import { StreamScreenProps } from '../../../services/stream-screen';
import { crazyClock } from '../local';

export default {
	screenType: 'framebuffer',
	displayDevice: '/dev/fb1',
	screenWidth: 160,
	screenHeight: 128,
	fontSizeScale: 0.5,
	streams: [
		{
			name: 'clock',
			url: crazyClock.mediamtxUrl('picam-secondary'),
			encoding: 'jpeg',
			detectionsSource: crazyClock.redisAndChannels('rh-image-detector:clock'),
		},
	],
} as const satisfies StreamScreenProps;
