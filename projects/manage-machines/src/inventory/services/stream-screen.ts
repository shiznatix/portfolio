import { TSchema } from '@sinclair/typebox';
import { pythonService } from '../../core/service/service-factory';
import { HostRedisUrlAndChannels } from '../../core/host/host-refs';

type ScreenType = (
	{
		screenType: 'kms';
		driver?: string; // ili9486
		displayDevice?: string;
	} | {
		screenType: 'framebuffer';
		displayDevice: string;
	} | {
		screenType: 'st7789';
		displayDevice?: never;
	}
);
export type StreamScreenProps = ScreenType & {
	screenWidth: number;
	screenHeight: number;
	screenFps?: number;
	screenRotate?: 0 | 90 | 180 | 270;
	splashRotate?: 0 | 90 | 180 | 270;
	overlayRotate?: 0 | 90 | 180 | 270;
	fontSizeScale?: number;
	streams: {
		name: string;
		url: string;
		encoding?: 'h264' | 'jpeg'; // default 'h264'
		abbreviation?: string;
		defaultBrightness?: number; // float - 0 = default, 1 = max
		defaultContrast?: number; // float - 0 = default, 1 = max
		overlays?: boolean;
		rotate?: 0 | 90 | 180 | 270;
		// when triggered, force the camera visible
		alertSchema?: TSchema;
		alertTimeoutSec?: number;
		// connection keep-alive options
		connectOnStart?: boolean;
		reconnectOnError?: 'always' | 'when-visible';
		stayConnected?: boolean; // if true and empty `stayConnectedSec`, will try to stay connected indefinitely
		stayConnectedSec?: number;
		detectionsSource?: HostRedisUrlAndChannels; // source of "detections" boxes for overlay
	}[];
	redisEvents?: HostRedisUrlAndChannels[];
	changeStreamDebounceSec?: number;
	pauseStreamSchema?: TSchema;
	incrementMenuSchema?: TSchema;
	decrementMenuSchema?: TSchema;
	incrementValueSchema?: TSchema;
	decrementValueSchema?: TSchema;
	notifications?: {
		name: string;
		noValueTemplate?: string;
		noValueBlink?: boolean;
		valueSchema?: TSchema;
		valueTemplate?: string;
		valueTemplateVars?: {
			[key: string]: (
				[string, 'split', string]
				| [string, 'match', ([string, TSchema])[]]
				| string
			);
		};
		valueBlink?: boolean | TSchema;
		removeSchema?: TSchema;
		removeAfterSec?: number;
		timeoutAfterSec?: number;
		timeoutTemplate?: string;
		timeoutBlink?: boolean;
	}[];
	ports?: {
		http?: number;
	};
};

export default pythonService<StreamScreenProps>()({
	name: 'stream-screen',
	unitFileTemplate: 'service',
	sudoers: [
		'/usr/bin/tee /sys/class/graphics/*/blank',
	],
	configJson: true,
	pythonSystemSitePackages: true,
	aptDependencies: [
		'libgirepository-2.0-dev',
		'gstreamer1.0-tools',
		'gstreamer1.0-libav',
		'gstreamer1.0-plugins-base',
		'gstreamer1.0-plugins-good',
		'gstreamer1.0-plugins-bad',
		'gstreamer1.0-plugins-ugly',
		'python3-gi',
		'python3-cairo',
		'python3-gi-cairo',
		'gir1.2-gst-plugins-base-1.0',
		'gir1.2-gstreamer-1.0',
		'gir1.2-cairo-1.0',
	],
	rsyncUpExcludes: [
		'user-conf',
	],
	piInterfaces: ['spi', 'i2c'],
	ports: {
		http: 8300,
	},
})
(Base => class extends Base {
	unitExecStartPre = this.props.displayDevice?.startsWith('/dev/fb')
		? `/bin/bash -c 'echo 0 | sudo tee /sys/class/graphics/${this.props.displayDevice?.replace('/dev/', '')}/blank'`
		: super.unitExecStartPre;
});
