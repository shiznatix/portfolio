import { pythonService } from '../../core/service/service-factory';

export type RhAssistantProps = {
	keyphrase: string;
	ollamaUrl: string;
	whisperApiUrl: string;
	piperApiUrl: string;
	tools?: {
		prometheus?: string;
		vlr?: string[];
	};
	ports?: {
		http?: number;
	};
};

export default pythonService<RhAssistantProps>()({
	name: 'rh-assistant',
	unitFileTemplate: 'service',
	configJson: true,
	aptDependencies: [
		// 'libportaudio2',
		// 'python3-pocketsphinx', // too old of a version
		// 'python3-pyaudio',

		'python3-numpy',
		'libportaudio2',
		'portaudio19-dev',

		// 'pipewire',
		// 'pipewire-pulse',
		// 'wireplumber',
		// 'pulseaudio-utils',
		// 'alsa-utils',
		// 'bluez',
		// 'bluez-firmware',
		// 'libspa-0.2-bluetooth',
		// 'libasound2-plugins',
		// 'portaudio19-dev',
	],
	ports: {
		http: 4700,
	},
})(Base => class extends Base {
});
