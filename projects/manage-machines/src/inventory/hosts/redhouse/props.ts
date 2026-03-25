import { PiProps } from '../../services/pi';
import { PiperVoiceProps } from '../../services/piper-voice';
import { OllamaProps } from '../../services/ollama';
import { WhisperApiProps } from '../../services/whisper-api';

export { default as rhAssistant } from './props/rh-assistant';
export const piperVoice: PiperVoiceProps = {};
export const pi: PiProps = { vnc: true };
export const ollama: OllamaProps = { models: [ 'tinyllama'] };
export const whisperApi: WhisperApiProps = { model: 'base.en' /* tiny.en */ };

// For testing
import { PrometheusProps } from '../../services/prometheus';
import { GrafanaProps } from '../../services/grafana';
import { WebScraperProps } from '../../services/web-scraper';
import { MediaMtxProps } from '../../services/mediamtx';
import { RhImageDetectorProps } from '../../services/rh-image-detector';
import { RhProxyProps } from '../../services/rh-proxy';
import { RhSensorsProps } from '../../services/rh-sensors';
import { crazyClock } from '../crazy-clock/local';
import { redhouse } from './local';
import secrets from '../../../../secrets.json';

export const prometheus: PrometheusProps = {};
export const docker = true;
export const grafana: GrafanaProps = {
	smtpEnabled: true,
	smtpHost: secrets.smtp.host,
	smtpPort: secrets.smtp.port,
	smtpUser: secrets.smtp.username,
	smtpPassword: secrets.smtp.token,
};
export const webScraper: WebScraperProps = {};
export const rhImageDetector: RhImageDetectorProps = {
	models: [{
		name: 'mediapipe.face',
	}],
	notifiers: {
		clock: [{
			debounceSec: 5,
			receiverUrls: [
				crazyClock.url('redis'),
				crazyClock.url('crayclk', '/faces'),
			],
		}],
	},
};
export const rhProxy: RhProxyProps = {
	routes: [
		{
			path: '/crayclk',
			destination: crazyClock.url('crayclk'),
		},
	],
};
export const rhSensors = {
	sensors: {
		'redhouse-thermohygrometer': {
			prometheusTitle: 'RedHouse',
			module: 'thermohygrometer-am2302',
			gpio: 17,
			logIntervalSec: 60,
		},
		'redhouse-temperature': {
			prometheusTitle: 'RedHouse',
			module: 'temperature-ds18b20',
			deviceIdPrefix: '28-',
		},
	},
} as const satisfies RhSensorsProps;
export const mediamtx = {
	cameras: {
		crayclk: {
			type: 'rtsp',
			url: crazyClock.mediamtxUrl('picam-secondary'),
			outWidth: 160,
			outHeight: 128,
			onDemand: true,
			startTimeoutSec: 60,
			detectors: ['mediapipe.face'],
			detectorHost: redhouse.ipAndPorts('rhImageDetector', 'input', 'output'),
		},
	},
} as const satisfies MediaMtxProps;
