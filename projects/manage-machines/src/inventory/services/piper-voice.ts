import { stackService } from '../../core/service/service-factory';

// https://rhasspy.github.io/piper-samples/

export type PiperVoiceProps = {
	defaultVoice?: string;
	voices?: string[];
	cuda?: boolean;
	historyMaxItems?: number;
	ports?: {
		server?: number;
		client?: number;
	};
};

export default stackService<PiperVoiceProps>()({
	name: 'piper-voice',
	isDirMaster: true,
	isDev: true,
	isPython: true,
	props: {
		defaultVoice: 'en_US-libritts_r-medium',
		voices: [
			'en_US-libritts_r-medium', // female, fast talk
			'en_US-amy-medium', // femele, clear
			'en_US-lessac-medium', // female, authoritative

			'en_US-joe-medium', // male, authoritave, clear
			'en_US-danny-low', // male, robotic
			'en_US-kusal-medium', // male, kinda robotic
		],
	},
	ports: {
		server: 9070,
		client: 9071,
	},
})

.sysd('piper-voice-server', { configJson: true, serviceTemplate: 'server' })
(Base => class extends Base {
	unitExecStartPre = `{{INSTALL_PATH}}/.venv/bin/python -m piper.download_voices --data-dir voices ${this.props.voices!.join(' ')}`;
	installSubDirs = [
		'voices',
		'history',
	];
	rsyncUpExcludes = [
		'voices',
		'history',
	];
	aptDependencies = [
		'ffmpeg',
	];
})

.sysd('piper-voice-client', { isNpm: true, serviceTemplate: 'client' })
(Base => class extends Base {
	configJson = {
		apiUrl: this.url('server'),
	};
})

.build({
	isInstallDir: true,
})();
