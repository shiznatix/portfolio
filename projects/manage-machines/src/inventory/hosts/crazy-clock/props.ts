import { CrazyClkProps } from '../../services/crayclk';
import { LcdDisplayProps } from '../../services/lcd-display';
import { PiProps } from '../../services/pi';

export { default as rhImageDetector } from './props/rh-image-detector';
export { default as mediamtx } from './props/mediamtx';
export { default as rhSensors } from './props/rh-sensors';
export { default as streamScreen } from './props/stream-screen';
export const crayclk: CrazyClkProps = { noDetectionMode: 'impossible' };
export const pi: PiProps = {
	activityLed: false,
	bluetooth: false,
	oneWire: false,
	cpuGovernor: 'performance',
	usbAutoSuspend: true,
};
export const lcdDisplay: LcdDisplayProps = {
	type: 'st7735',
	speed: 4000000,
	rotate: 270,
};
export const redis = true;
