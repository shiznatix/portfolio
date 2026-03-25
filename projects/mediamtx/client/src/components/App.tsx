import '../globals.d.ts';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemedApp } from '@rh/react';
import React, { useMemo } from 'react';

import { CamerasStaticContext } from '../contexts/context';
import { CameraConfig, CameraStreamType } from '../types';
import CamerasGrid from './CamerasGrid';

const REFRESH_STATS_MS = 5000;
const REFRESH_STREAMS_MS = 2000;

type CameraUrls = {
	rtcPeerUrl?: string | null;
	mjpgUrl?: string | null;
};

function makeKey(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function deriveStreamTypes(cam: CameraUrls): CameraStreamType[] {
	const types: CameraStreamType[] = [];

	if (cam.rtcPeerUrl) {
		types.push('rtcpeer');
	}
	if (cam.mjpgUrl) {
		types.push('mjpeg');
	}
	return types.length > 0 ? types : ['rtcpeer'];
}

function buildCameraConfigs(): CameraConfig[] {
	return window.CONFIG.cameras.map(cam => ({
		key: makeKey(cam.name),
		streamTypes: deriveStreamTypes(cam),
		name: cam.name,
		rtcPeerUrl: cam.rtcPeerUrl,
		mjpgUrl: cam.mjpgUrl ?? null,
		statsUrl: cam.statsUrl,
		readerStatsUrlTemplate: cam.readerStatsUrlTemplate,
		recordingsUrl: cam.recordingsUrl ?? null,
		servosUrl: cam.servosUrl ?? null,
		canPan: cam.canPan ?? false,
		canTilt: cam.canTilt ?? false,
		canShutter: cam.canShutter ?? false,
		rotate: cam.rotate ?? 0,
	}));
}

const App: React.FC = () => {
	const cameraConfigs = useMemo(() => buildCameraConfigs(), []);

	return (
		<ThemedApp service="mediamtx">
			<CssBaseline />
			<CamerasStaticContext.Provider value={{
				refreshStatsMs: REFRESH_STATS_MS,
				refreshStreamsMs: REFRESH_STREAMS_MS,
			}}>
				<CamerasGrid cameraConfigs={cameraConfigs} />
			</CamerasStaticContext.Provider>
		</ThemedApp>
	);
};

export default App;
