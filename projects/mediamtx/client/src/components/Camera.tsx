import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import React, { useContext, useEffect, useState } from 'react';

import { CamerasStaticContext } from '../contexts/context';
import { useCameraBrowserFlags, useCameraConfig, useCameraContext, useCameraMetadata, useCameraRefs, useCameraUiState } from '../contexts/context';
import { useFetchStatsCallback, useFetchStatsEffect } from '../hooks/use-fetch-stats';
import { CameraUiState } from '../types';
import CameraCard from './CameraCard';
import RecordingsDialog from './dialogs/RecordingsDialog';
import StatsDialog from './dialogs/StatsDialog';

interface CameraProps {
	onCardSettingsChange: (uiState: Partial<CameraUiState>) => void;
}

const Camera: React.FC<CameraProps> = (props) => {
	const { refreshStatsMs } = useContext(CamerasStaticContext);
	const { setMetadata, setUiState } = useCameraContext();
	const browserFlags = useCameraBrowserFlags();
	const config = useCameraConfig();
	const uiState = useCameraUiState();
	const metadata = useCameraMetadata();
	const refs = useCameraRefs();
	const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

	useFetchStatsEffect({
		paused: uiState.paused || !uiState.metadataExpanded || metadata.streamStatus !== 'connected',
		refreshStatsMs,
		callback: useFetchStatsCallback({
			type: 'simple',
			cameraConfig: config,
			onStats: (stats) => setMetadata(m => ({
				...m,
				readersCount: stats.readers.length,
			})),
			onError: () => setMetadata(m => ({
				...m,
				readersCount: null,
			})),
		}),
	});

	useEffect(() => {
		// limit the stream types to only those available
		const newStreamType = !config.streamTypes.includes(uiState.streamType)
			? 'rtcpeer'
			: uiState.streamType;

		if (newStreamType !== uiState.streamType) {
			props.onCardSettingsChange({ streamType: newStreamType });
		}

		setMetadata(m => ({
			...m,
			streamType: newStreamType,
			fps: null,
			fullscreen: false,
			streamError: null,
			streamStatus: 'uninstantiated',
			readersCount: null,
			lastFrameTime: null,
		}));
	}, [uiState.streamType, config.streamTypes]);
	useEffect(() => {
		if (refs.container.current && refs.container.current.requestFullscreen) {
			if (document.fullscreenElement && !metadata.fullscreen) {
				document.exitFullscreen();
			} else if (!document.fullscreenElement && metadata.fullscreen) {
				refs.container.current.requestFullscreen();
			}
		} else if (refs.video.current && metadata.fullscreen) {
			// iOS specific fullscreen handling
			if ('webkitEnterFullscreen' in refs.video.current && typeof refs.video.current.webkitEnterFullscreen === 'function') {
				refs.video.current.webkitEnterFullscreen();
			} else if ('webkitRequestFullscreen' in refs.video.current && typeof refs.video.current.webkitRequestFullscreen === 'function') {
				refs.video.current.webkitRequestFullscreen();
			}
		}
	}, [metadata.fullscreen]);
	useEffect(() => {
		if (refs.video.current) {
			if (document.pictureInPictureElement && !metadata.picInPic) {
				document.exitPictureInPicture();
			} else if (!document.pictureInPictureElement && metadata.picInPic) {
				if (!refs.video.current.requestPictureInPicture) {
					setNotificationMessage('Picture-in-Picture mode is not supported by your browser.');
				} else {
					refs.video.current.requestPictureInPicture();
				}
			}
		}
	}, [metadata.picInPic]);
	useEffect(() => {
		if (refs.video.current) {
			if (refs.video.current.srcObject && !refs.video.current.paused && !refs.video.current.requestPictureInPicture) {
				setMetadata(m => ({
					...m,
					picInPic: null,
				}));
			}
		}
	}, [refs.video.current?.srcObject && refs.video.current?.paused]);
	useEffect(() => {
		if (uiState.paused) {
			return;
		}

		const handFullscreenChange = (fullscreen: boolean) => {
			setMetadata(m => ({
				...m,
				fullscreen,
			}));

			// iOS pauses the stream when exiting fullscreen. Resume playing in this case
			setTimeout(() => {
				if (!fullscreen && !uiState.paused && refs.video.current?.paused) {
					refs.video.current.play().catch(() => {
						// Silently handle play errors
					});
				}
			}, 1000);
		};

		const onError = () => {
			setMetadata(m => ({
				...m,
				streamStatus: 'closed',
				streamError: 'Video playback error',
			}));
		};
		const onLoadedData = () => {
			if (refs.video.current && !browserFlags.disablePicInPic) {
				setMetadata(m => ({
					...m,
					picInPic: refs.video.current
						// @ts-expect-error
						? refs.video.current.requestPictureInPicture
							? !!m.picInPic
							: null
						: m.picInPic,
				}));
			}
		};
		const onFullscreenChange = () => {
			const fullscreen = !!document.fullscreenElement
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				|| !!(document as any).webkitFullscreenElement
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				|| !!(refs.video.current as any)?.webkitDisplayingFullscreen;

			handFullscreenChange(fullscreen);
		};
		const onEnterPicInPic = () => {
			setMetadata(m => ({
				...m,
				picInPic: true,
			}));
		};
		const onLeavePicInPic = () => {
			setMetadata(m => ({
				...m,
				picInPic: false,
			}));
		};
		const onWebkitBeginFullscreen = () => handFullscreenChange(true);
		const onWebkitEndFullscreen = () => handFullscreenChange(false);

		if (refs.container.current) {
			refs.container.current.addEventListener('error', onError);
			refs.container.current.addEventListener('fullscreenchange', onFullscreenChange);
			refs.container.current.addEventListener('webkitfullscreenchange', onFullscreenChange);
		}
		if (refs.video.current) {
			refs.video.current.addEventListener('error', onError);
			refs.video.current.addEventListener('loadeddata', onLoadedData);
			refs.video.current.addEventListener('fullscreenchange', onFullscreenChange);
			refs.video.current.addEventListener('webkitfullscreenchange', onFullscreenChange);
			refs.video.current.addEventListener('webkitbeginfullscreen', onWebkitBeginFullscreen);
			refs.video.current.addEventListener('webkitendfullscreen', onWebkitEndFullscreen);
			refs.video.current.addEventListener('enterpicInPic', onEnterPicInPic);
			refs.video.current.addEventListener('leavepicInPic', onLeavePicInPic);
		}

		return () => {
			if (refs.container.current) {
				refs.container.current.removeEventListener('error', onError);
				refs.container.current.removeEventListener('fullscreenchange', onFullscreenChange);
				refs.container.current.removeEventListener('webkitfullscreenchange', onFullscreenChange);
			}
			if (refs.video.current) {
				refs.video.current.removeEventListener('error', onError);
				refs.video.current.removeEventListener('loadeddata', onLoadedData);
				refs.video.current.removeEventListener('fullscreenchange', onFullscreenChange);
				refs.video.current.removeEventListener('webkitfullscreenchange', onFullscreenChange);
				refs.video.current.removeEventListener('webkitbeginfullscreen', onWebkitBeginFullscreen);
				refs.video.current.removeEventListener('webkitendfullscreen', onWebkitEndFullscreen);
				refs.video.current.removeEventListener('enterpicInPic', onEnterPicInPic);
				refs.video.current.removeEventListener('leavepicInPic', onLeavePicInPic);
			}
		};
	}, [uiState.paused]);
	useEffect(() => {
		props.onCardSettingsChange(uiState);
	}, [uiState]);

	return (
		<>
			<CameraCard />

			<StatsDialog
				cameraConfig={config}
				open={uiState.statsDialogOpen}
				onClose={() => setUiState(prev => ({ ...prev, statsDialogOpen: false }))}
			/>
			<RecordingsDialog
				cameraConfig={config}
				open={uiState.recordingsDialogOpen}
				onClose={() => setUiState(prev => ({ ...prev, recordingsDialogOpen: false }))}
			/>

			<Snackbar
				autoHideDuration={4000}
				open={!!notificationMessage}
				onClose={() => setNotificationMessage(null)}
			>
				<Alert severity="error" onClose={() => setNotificationMessage(null)}>
					{notificationMessage}
				</Alert>
			</Snackbar>
		</>
	);
};

export default Camera;
