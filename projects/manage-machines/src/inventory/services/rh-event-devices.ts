import { TSchema } from '@sinclair/typebox';
import { pythonService } from '../../core/service/service-factory';

type Color = [number, number, number];

type OledDisplay = {
	i2cPort?: number;
	height: number;
	width: number;
	rotate?: 0 | 1 | 2 | 3;
	device: 'ssd1306' | 'sh1106';
	screens: {
		displaySecs: number;
		background?: 'black' | 'white';
		border?: 'black' | 'white';
		boxes: (
			{
				x: number;
				y: number;
				width: number;
				height: number;
				animate?: {
					type: 'swim-left-right';
					pixelJumpX: number;
					pixelJumpY: number;
				} | {
					type: 'scroll-left-right';
					pixelJumpX: number;
				};
				halign?: 'left' | 'center' | 'right';
				valign?: 'top' | 'center' | 'bottom';
				hflip?: boolean;
				vflip?: boolean;
			} & (
				{
					image: {
						fileName: string;
						width?: number;
						height?: number;
					};
				}
				| {
					text: {
						fontSize: number;
						strokeWidth?: number;

					} & (
						{
							text: string;
						}
						| {
							matchSchema: TSchema;
							template: string;
							valueRoundDecimal?: number;
						}
					);
				}
			)
		)[];
	}[];
};

type ReceiverPixelsAnimation = {
	type: 'static';
	color: Color;
	brightness: number;
} | {
	type: 'blink';
	colors: Color[];
	brightness: number;
	delaySec: number;
} | {
	type: 'day-fade';
	// starts from the 0th second of the day
	timeBlocks: {
		durationSec: number;
		startColor: Color;
		endColor: Color;
		startBrightness?: number;
		endBrightness?: number;
	}[];
};

type Receivers = {
	buzzers?: {
		[key: string]: {
			prometheusTitle: string;
			gpio: 12 | 18 | 13 | 19; // PWM GPIOs
			cooldownSec: number;
			doubleCooldownSec?: number;
			sources: {
				matchSchema: TSchema;
				repeat?: number;
				repeatDelaySec?: number;
				melody: [
					// tone
					boolean | 'A5' | 'G5' | 'F5' | 'E5' | 'D5' | 'C5' | 'B4' | 'A4' | 'G4' | 'F4' | 'E4' | 'D4' | 'C4' | 'B3' | 'A3',
					// playSec
					number,
				][];
			}[];
		};
	};
	pixels?: {
		[key: string]: {
			prometheusTitle: string;
			count: number;
			maxBrightness?: number;
			pixelsOnFraction?: 1 | 2 | 3 | 4;
			defaultAnimation: ReceiverPixelsAnimation;
			sources?: (
				{
					type: 'disable-sources';
					matchSchema: TSchema;
					disableSources: string[];
				}
				| {
					type: 'inverse-ambient-brightness';
					matchSchema: TSchema;
					offAboveValue?: number;
					minValue?: number;
					maxValue?: number;
				}
				| {
					type: 'match-ambient-brightness';
					matchSchema: TSchema;
					offAboveValue?: number;
					offBelowValue?: number;
					minValue?: number;
					maxValue?: number;
				}
				| {
					type: 'change-brightness';
					matchSchema: TSchema;
					step?: number; // float between 0 and 1
					min?: number;
					max?: number;
				}
				| {
					type: 'cycle-animations';
					matchSchema: TSchema;
					animations: ReceiverPixelsAnimation[],
				}
				| {
					type: 'lock-animation';
					matchSchema: TSchema;
					animation: ReceiverPixelsAnimation | null; // `null` to unlock
				}
			)[];
		} & (
			{
				type: 'neopixel';
				gpioData: number;
			}
			| {
				type: 'dotstar';
				gpioClock: number;
				gpioData: number;
			}
		);
	};
	// SSD1306 OLED Display 128x32 pixels
	// SH1106 OLED Display 128x64 pixels
	oledDisplays?: {
		[key: string]: OledDisplay;
	};
	cameraStreams?: {
		[key: string]: {
			prometheusTitle: string;
			rtspUrl: string;
			bufferSecs: number;
			recordSecs: number;
			framerate: number;
			recordingsPath: string;
			recordingsOwner?: string;
			recordingsMaxAgeSecs?: number;
			extractFrames?: boolean;
			sources: {
				matchSchema: TSchema;
			}[];
			receiverUrls?: string[];
		};
	};
	leds?: {
		[key: string]: {
			prometheusTitle: string;
			gpio: number;
			sources: {
				matchSchema: TSchema;
				onSecs: number;
				offSecs: number;
				repeat?: number;
			}[];
		};
	};
};

export type RhEventDevicesProps = {
	receivers: Receivers;
	ports?: {
		http?: number;
	};
};

export default pythonService<RhEventDevicesProps>()({
	name: 'rh-event-devices',
	serviceTemplate: 'service',
	configJson: true,
	unitExecSudo: true,
	pythonSystemSitePackages: true,
	aptDependencies: [
		'python3-lgpio',
	],
	ports: {
		http: 8030,
	},
})
(Base => class extends Base {
});
