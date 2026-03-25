import { isCameraStreamType } from '../types';
import { CameraUiState } from '../types';

const KEY_CAMERA_SETTINGS = 'cameraSettings';

export function makeCameraSettings(cameraUiState?: Partial<CameraUiState>): CameraUiState {
	return {
		streamType: isCameraStreamType(cameraUiState?.streamType) ? cameraUiState.streamType : 'rtcpeer',
		metadataExpanded: typeof cameraUiState?.metadataExpanded === 'boolean' ? cameraUiState.metadataExpanded : false,
		controlsExpanded: typeof cameraUiState?.controlsExpanded === 'boolean' ? cameraUiState.controlsExpanded : true,
		paused: typeof cameraUiState?.paused === 'boolean' ? cameraUiState.paused : true,
		brightness: typeof cameraUiState?.brightness === 'string' ? cameraUiState.brightness : '100%',
		position: {
			x: typeof cameraUiState?.position?.x === 'number' ? cameraUiState.position.x : 0,
			y: typeof cameraUiState?.position?.y === 'number' ? cameraUiState.position.y : 0,
			w: typeof cameraUiState?.position?.w === 'number' ? cameraUiState.position.w : 0,
			h: typeof cameraUiState?.position?.h === 'number' ? cameraUiState.position.h : 0,
		},
		statsDialogOpen: false,
		recordingsDialogOpen: false,
	};
}

export function getCameraSettings(): Record<string, CameraUiState> {
	const saved = localStorage.getItem(KEY_CAMERA_SETTINGS);
	const raw: unknown = saved ? JSON.parse(saved) : {};
	const settings: Record<string, CameraUiState> = {};

	if (raw && typeof raw === 'object') {
		for (const [camKey, cameraState] of Object.entries(raw)) {
			if (typeof camKey === 'string' && cameraState && typeof cameraState === 'object') {
				settings[camKey] = makeCameraSettings(cameraState as Partial<CameraUiState>);
			}
		}
	}

	return settings;
}

export function setCameraSettings(camKey: string, uiState: CameraUiState) {
	const settings = getCameraSettings();
	settings[camKey] = uiState;
	localStorage.setItem(KEY_CAMERA_SETTINGS, JSON.stringify(settings));
}
