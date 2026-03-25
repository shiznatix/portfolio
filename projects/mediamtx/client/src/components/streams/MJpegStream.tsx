import Box from '@mui/material/Box';
import React, { useContext, useEffect, useRef, useState } from 'react';

import { CamerasStaticContext } from '../../contexts/context';
import {
	useBrightness,
	useCameraConfig,
	useCameraContext,
	usePaused,
	useRotate,
	useStreamType
} from '../../contexts/context';
import { getDateTime } from '../../functions';

function makeCameraUrl(mjpgUrl: string, cacheBreaker: number): string {
	return `${mjpgUrl}?rand=${cacheBreaker}`;
}

const MJpegStream: React.FC = () => {
	const ref = useRef<HTMLImageElement>(null);
	const { refreshStreamsMs } = useContext(CamerasStaticContext);
	const { setMetadata } = useCameraContext();
	const cameraConfig = useCameraConfig();
	const paused = usePaused();
	const streamType = useStreamType();
	const brightness = useBrightness();
	const rotate = useRotate();

	// Consider paused if streamType is not mjpeg OR if actually paused
	const effectivelyPaused = paused || streamType !== 'mjpeg';

	const [cacheBreaker, setCacheBreaker] = useState(Math.random());
	const [camStreamUrl, setCamStreamUrl] = useState<string | null>(null);
	const [lastFrameTime, setLastFrameTime] = useState<number | null>(null);
	const [fpsTimer, setFpsTimer] = useState(0);
	const [framesCount, setFramesCount] = useState(0);

	// Only Firefox triggers `onLoad` event for each frame of a MJPEG stream.
	// Maybe other browsers can as well, look into this...
	const calculateFps = navigator.userAgent.includes('Firefox');

	useEffect(() => {
		return () => {
			setCamStreamUrl(null);
			if (ref.current) {
				// drop http connection on unmount
				ref.current.src = '';
			}
		};
	}, []);

	useEffect(() => {
		if (effectivelyPaused) {
			setCamStreamUrl(null);
		}
	}, [effectivelyPaused]);

	useEffect(() => {
		if (effectivelyPaused) {
			return;
		}

		const streamsInterval = setInterval(() => setCacheBreaker(Math.random()), refreshStreamsMs);
		return () => clearInterval(streamsInterval);
	}, [effectivelyPaused, refreshStreamsMs]);

	useEffect(() => {
		if (!calculateFps || effectivelyPaused) {
			return;
		}

		// if no new frames in 3 seconds then stream is offline
		const frameTimeoutInterval = setInterval(() => {
			setMetadata(prev => ({
				...prev,
				streamStatus: 'closed',
				streamError: 'OFFLINE',
			}));
		}, 3000);

		// if no new frames in 1 second then fps is 0
		const timer = setTimeout(() => {
			setMetadata(prev => ({ ...prev, fps: 0 }));
		}, 1000);

		return () => {
			clearInterval(frameTimeoutInterval);
			clearTimeout(timer);
		};
	}, [effectivelyPaused, lastFrameTime, calculateFps, setMetadata]);

	useEffect(() => {
		if (!camStreamUrl && !effectivelyPaused && cameraConfig.mjpgUrl) {
			console.log(`Empty camStreamUrl for ${cameraConfig.name}`);
			setCamStreamUrl(makeCameraUrl(cameraConfig.mjpgUrl, cacheBreaker));
		}
	}, [effectivelyPaused, camStreamUrl, cameraConfig.mjpgUrl, cameraConfig.name, cacheBreaker]);

	useEffect(() => {
		if (!camStreamUrl || effectivelyPaused || !cameraConfig.mjpgUrl) {
			return;
		}

		console.log(`Cache break camStreamUrl for ${cameraConfig.name}`);
		setCamStreamUrl(makeCameraUrl(cameraConfig.mjpgUrl, cacheBreaker));
	}, [cameraConfig.mjpgUrl, cameraConfig.name, effectivelyPaused, cacheBreaker, camStreamUrl]);

	const onError = () => {
		if (camStreamUrl && !effectivelyPaused) {
			setMetadata(prev => ({
				...prev,
				streamStatus: 'closed',
				streamError: 'OFFLINE',
			}));
		}
	};

	const onLoad = () => {
		if (calculateFps) {
			const date = new Date();
			const now = date.getTime();
			const newFramesCount = framesCount + 1;

			setLastFrameTime(now);
			setFramesCount(newFramesCount);

			if (now - fpsTimer > 3000) {
				setMetadata(prev => ({ ...prev, fps: Math.ceil(newFramesCount / 3) }));
				setFramesCount(0);
				setFpsTimer(now);
			}

			// if we have more than 1 frame then stream is online
			// when the stream goes offline and we cycle the URL, `onLoad` is called because the image is still in cache
			// so we need to check if we have more than 1 frame to know if the stream is online
			if (newFramesCount > 1) {
				setMetadata(prev => ({
					...prev,
					streamStatus: 'connected',
					streamError: null,
					lastFrameTime: getDateTime(date),
				}));
			}
		} else {
			setMetadata(prev => ({
				...prev,
				streamStatus: 'connected',
				streamError: null,
			}));
		}
	};

	return (
		<Box
			ref={ref}
			component="img"
			src={camStreamUrl || undefined}
			onError={onError}
			onLoad={onLoad}
			sx={{
				display: paused ? 'none' : 'block',
				height: '100%',
				width: '100%',
				filter: `brightness(${brightness})`,
				transform: `rotate(${rotate || 0}deg)`,
			}}
		/>
	);
};

export default MJpegStream;
