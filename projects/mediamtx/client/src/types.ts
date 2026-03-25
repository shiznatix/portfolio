// TODO - globalize
export type MuiColor = 'warning' | 'error' | 'primary' | 'success' | 'secondary' | 'info';

export const cameraStreamTypes = ['rtcpeer', 'mjpeg'] as const;
export type CameraStreamType = typeof cameraStreamTypes[number];
export function isCameraStreamType(type: unknown): type is CameraStreamType {
	return typeof type === 'string' && cameraStreamTypes.includes(type as CameraStreamType);
}

export type CameraConfig = Readonly<{
	key: string;
	streamTypes: CameraStreamType[];
	// from config.json
	name: string;
	rtcPeerUrl: string;
	mjpgUrl: string | null;
	statsUrl: string;
	readerStatsUrlTemplate: string;
	recordingsUrl: string | null;
	rotate: 0 | 90 | 180 | 270;
	servosUrl: string | null;
	canPan: boolean;
	canTilt: boolean;
	canShutter: boolean;
}>;

export type CameraRefs = {
	video: React.RefObject<HTMLVideoElement | null>;
	container: React.RefObject<HTMLDivElement | null>;
};
export type CameraMetadata = {
	streamType: CameraStreamType;
	streamStatus: CameraStreamStatus;
	streamError: string | null;
	actionError: string | null;
	picInPic: boolean | null; // null if not supported
	fullscreen: boolean;
	fullscreenRef: CameraRefs['video'] | CameraRefs['container'] | null;
	fps: number | null;
	lastFrameTime: string | null;
	readersCount: number | null;
	recording: boolean;
};

export type CameraBrowserFlags = {
	disablePicInPic: boolean;
};

export type CameraStatsApiResult = {
	name: string;
	source: {
		type: string;
	};
	ready: boolean;
	readyTime: string;
	tracks: string[];
	bytesReceived: number;
	bytesSent: number;
	readers: {
		type: string;
		id: string;
	}[];
};
export type CameraReaderDataApiResult = {
	id: string;
	created: string;
	remoteAddr: string;
	peerConnectionEstablished: boolean;
	localCandidate: string;
	remoteCandidate: string;
	state: string;
	path: string;
	query: string;
	bytesReceived: number;
	bytesSent: number;
};

export type CameraStatsSimple = CameraStatsApiResult & {
	timestamp: number;
};
export type CameraStatsDetailed = Exclude<CameraStatsApiResult, 'readers'> & {
	readers: CameraReaderDataApiResult[];
};
export type CameraStats = CameraStatsSimple | CameraStatsDetailed;

export const cameraStreamStatus = ['connecting', 'connected', 'closing', 'closed', 'uninstantiated'] as const;
export type CameraStreamStatus = typeof cameraStreamStatus[number];

export type CameraUiState = {
	streamType: CameraStreamType;
	metadataExpanded: boolean;
	controlsExpanded: boolean;
	paused: boolean;
	brightness: string;
	position: {
		x: number;
		y: number;
		w: number;
		h: number;
	};
	statsDialogOpen: boolean;
	recordingsDialogOpen: boolean;
};
