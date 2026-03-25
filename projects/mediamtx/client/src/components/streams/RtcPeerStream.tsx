import Box from '@mui/material/Box';
import React, { useCallback, useEffect, useRef } from 'react';

import {
	useBrightness,
	useCameraContext,
	usePaused,
	useRotate,
	useRtcPeerUrl,
	useStreamType,
	useVideoRef} from '../../contexts/context';
import { getDateTime } from '../../functions';
import { useAutoplayPermission } from '../../hooks/use-autoplay-permission';
import { useMediaRecorder } from '../../hooks/use-media-recorder';
import MediaMTXWebRTCReader from '../../mediamtx-webrtc-reader';
import { CameraMetadata } from '../../types';

const RtcPeerStream: React.FC = () => {
	useMediaRecorder();

	const videoRef = useVideoRef();
	const { setMetadata } = useCameraContext();
	const rtcPeerUrl = useRtcPeerUrl();
	const paused = usePaused();
	const streamType = useStreamType();
	const brightness = useBrightness();
	const rotate = useRotate();
	const readerRef = useRef<MediaMTXWebRTCReader | null>(null);
	const { showControls, handleAutoplayBlocked } = useAutoplayPermission();

	// Consider paused if streamType is not rtcpeer OR if actually paused
	const effectivelyPaused = paused || streamType !== 'rtcpeer';

	const createReader = useCallback(() => {
		const currentVideoRef = videoRef.current;

		if (!currentVideoRef) {
			return;
		}
		if (readerRef.current) {
			readerRef.current.close();
			readerRef.current = null;
		}

		try {
			// Set initial connecting status
			setMetadata(prev => ({
				...prev,
				streamStatus: 'connecting',
				streamError: null,
			}));

			const reader = new MediaMTXWebRTCReader({
				url: rtcPeerUrl as string,
				onError: (err: string) => {
					setMetadata(prev => ({
						...prev,
						streamStatus: 'closed',
						streamError: err,
					}));
				},
				onTrack: (event: RTCTrackEvent) => {
					const stream = event.streams[0];

					if (stream && currentVideoRef) {
						currentVideoRef.srcObject = stream;
						currentVideoRef.play().catch((err: unknown) => {
							if (err instanceof DOMException && err.name === 'NotAllowedError') {
								handleAutoplayBlocked();
							}
						});
					}
				}
			});

			readerRef.current = reader;
		} catch (err) {
			setMetadata(prev => ({
				...prev,
				streamStatus: 'closed',
				streamError: `Failed to create MediaMTX reader: ${err}`,
			}));
		}
	}, [rtcPeerUrl, setMetadata, videoRef]);

	useEffect(() => {
		const currentVideoRef = videoRef.current;

		if (effectivelyPaused) {
			if (readerRef.current) {
				readerRef.current.close();
				readerRef.current = null;
			}
			if (currentVideoRef) {
				currentVideoRef.srcObject = null;
			}
			setMetadata(prev => ({ ...prev, streamStatus: 'closed' }));
		} else {
			createReader();
		}

		// Cleanup on unmount
		return () => {
			if (readerRef.current) {
				readerRef.current.close();
				readerRef.current = null;
			}
		};
	}, [effectivelyPaused, createReader, setMetadata, videoRef]);

	useEffect(() => {
		if (effectivelyPaused) {
			return;
		}

		const interval = setInterval(async () => {
			const reader = readerRef.current;
			const stats = reader ? await reader.getStats() : null;
			const state = reader ? reader.getState() : null;
			const fps = stats?.framesPerSecond || 0;
			const metadataUpdate: Partial<CameraMetadata> = {
				fps,
			};

			if (!state) {
				metadataUpdate.streamStatus = 'uninstantiated';
			} else if (state === 'closed' || state === 'failed') {
				metadataUpdate.streamStatus = 'closed';
			} else if (state === 'get-codecs' || state === 'restarting') {
				metadataUpdate.streamStatus = 'connecting';
			} else if (state === 'running') {
				metadataUpdate.streamError = null;

				if (fps > 0) {
					metadataUpdate.streamStatus = 'connected';
					metadataUpdate.lastFrameTime = getDateTime(new Date());
				} else {
					metadataUpdate.streamStatus = 'connecting';
				}
			}

			setMetadata(prev => ({ ...prev, ...metadataUpdate }));
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	}, [paused, setMetadata]);

	return (
		<Box
			component="video"
			ref={videoRef}
			autoPlay={true}
			muted={true}
			playsInline={true}
			controls={showControls}
			controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
			disablePictureInPicture={false}
			preload="none"
			sx={{
				display: paused ? 'none' : 'block',
				height: '100%',
				width: '100%',
				filter: `brightness(${brightness})`,
				transform: `rotate(${rotate || 0}deg)`,
				objectFit: 'fill',
			}}
		/>
	);
};

export default RtcPeerStream;
