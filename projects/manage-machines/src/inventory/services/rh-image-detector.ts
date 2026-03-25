import { pythonService } from '../../core/service/service-factory';

type MediaPipeFaceConfig = {
	name: 'mediapipe.face';
	modelSelection?: 'short-range' | 'full-range';
	detectionThreshold?: number;
};

type MediaPipeObjectronConfig = {
	name: `mediapipe.${'shoe' | 'chair' | 'cup' | 'camera'}`;
	maxNumObjects?: number;
	detectionThreshold?: number;
	trackingThreshold?: number;
	width?: number;
	height?: number;
};

type BlazeFaceConfig = {
	name: 'blazeface';
	modelPath: string;
	width: number;
	height: number;
	threshold?: number;
};
type YOLOFaceConfig = {
	name: 'yolo.face';
	modelPath: string;
	threshold?: number;
};

export type RhImageDetectorModel =
	MediaPipeFaceConfig['name']
	| MediaPipeObjectronConfig['name']
	| BlazeFaceConfig['name']
	| YOLOFaceConfig['name'];
type RhImageDetectorModelConfig =
	MediaPipeFaceConfig
	| MediaPipeObjectronConfig
	| BlazeFaceConfig
	| YOLOFaceConfig;

export type RhImageDetectorProps = {
	models: RhImageDetectorModelConfig[];
	notifiers?: Record<string, {
		debounceSec: number;
		receiverUrls: string[];
	}[]>;
	readStreams?: Record<string, {
		url: string;
		detectorNames: RhImageDetectorModel[];
	}>;
	ports?: {
		input?: number;
		output?: number;
	};
};

export default pythonService<RhImageDetectorProps>()({
	name: 'rh-image-detector',
	unitFileTemplate: 'service',
	aptDependencies: [
		'build-essential',
		'zlib1g-dev',
		'libssl-dev',
		'libffi-dev',
		'libbz2-dev',
		'libreadline-dev',
		'libsqlite3-dev',
		'libncurses5-dev',
		'libgdbm-dev',
		'liblzma-dev',
		'tk-dev',
		'uuid-dev',
		'wget',
		'curl',
	],
	isPython: true,
	configJson: true,
	sudoers: [
		'/usr/bin/make install'
	],
	props: {
		models: [],
	},
	ports: {
		input: 5420,
		output: 5421,
	},
})
(Base => class extends Base {
	pythonExtraPackages = this.props.models.map(m => m.name.split('.')[0]);
});
