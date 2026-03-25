import { hook } from '../../core/service/annotations';
import { pythonService } from '../../core/service/service-factory';

type TextFrameBase = {
	type: 'text';
	text: string;
	color: [number, number, number] | 'rainbow';
	font: 'unscii-8' | 'unscii-8-alt' | 'unscii-8-fantasy' | 'unscii-8-mcr' | 'unscii-8-tall' | 'unscii-8-thin';
	fontSize: number;
	letterSpacing?: number;
	wordSpacing?: number;
	lineSpacing?: number;
	yOffset?: number;
};
type TextFrameStatic = TextFrameBase & {
	mode: 'static';
	durationSec?: number;
};
type TextFrameBlink = TextFrameBase & {
	mode: 'blink';
	onSec?: number;
	offSec?: number;
	repeat?: number;
};
type TextFrameScroll = TextFrameBase & {
	mode: 'scroll';
	delaySec?: number;
};

type ImageFrame = {
	type: 'image';
	fileName: string;
	durationSec?: number;
};
type GifFrame = {
	type: 'gif';
	fileName: string;
	delaySec: number;
	repeat?: number;
};
type ColorFrame = {
	type: 'color';
	color: [number, number, number] | 'rainbow';
	duractionSec: number;
};

export type LedMatrixProps = {
	config: {
		matrixes: {
			name: string;
			gpio: number;
			width: number;
			height: number;
			brightness?: number;
			minBrightness?: number;
			maxBrightness?: number;
			frameSets: {
				name: string;
				frames: (
					| TextFrameStatic
					| TextFrameBlink
					| TextFrameScroll
					| ImageFrame
					| GifFrame
					| ColorFrame
				)[];
			}[];
		}[];
		rotary?: {
			gpioClk: number;
			gpioDt: number;
			gpioPress: number;
			maxSteps: number;
			debounceSec: number;
		};
	};
	images?: {
		localPath: string;
		remoteName: string;
	}[];
};

export default pythonService<LedMatrixProps>()({
	name: 'led-matrix',
	configJson: true,
	installSubDirs: ['images'],
	aptDependencies: [
		'python3-gpiozero',
	],
})(Base => class extends Base {
	@hook('sync.end', t => t.props.images?.length)
	async afterSync() {
		for (const image of this.props.images!) {
			await this.scp('up', {
				localPath: image.localPath,
				remotePath: `${this.host.username}@${this.host.ip}:${this.workDir}/images/${image.remoteName}`,
			});
		}
	}
});
