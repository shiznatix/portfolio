import { useEffect, useRef } from 'react';

import { useCameraContext, useCameraName, useRecording, useVideoRef } from '../contexts/context';

// Prefer codecs that explicitly cover both audio + video tracks.
// Fall back to video-only codec variants (used with a video-only stream below).
const WEBM_MIME_TYPES_AV = [
	'video/webm;codecs=vp9,opus',
	'video/webm;codecs=vp8,opus',
];
const WEBM_MIME_TYPES_V = [
	'video/webm;codecs=vp9',
	'video/webm;codecs=vp8',
	'video/webm',
];

export const useMediaRecorder = () => {
	const videoRef = useVideoRef();
	const recording = useRecording();
	const cameraName = useCameraName();
	const { setMetadata } = useCameraContext();
	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);

	useEffect(() => {
		if (!recording) {
			return;
		}

		const video = videoRef.current;
		const sourceStream = video?.srcObject as MediaStream | null;
		const hasAudio = !!sourceStream?.getAudioTracks().length;

		if (!sourceStream) {
			setMetadata(prev => ({
				...prev,
				recording: false,
				actionError: 'Recording failed: No active MediaStream',
			}));
			return;
		}

		// Pick the best supported MIME type. When the stream has audio tracks, prefer
		// a type that names an audio codec too, to avoid the "audio track cannot be
		// recorded" DOMException. If no combined A/V type is supported, strip out the
		// audio tracks so we can safely use a video-only codec.
		let mimeType = hasAudio
			? WEBM_MIME_TYPES_AV.find(t => MediaRecorder.isTypeSupported(t))
			: null;
		let stream = sourceStream;

		if (hasAudio && !mimeType) {
			// Fall back to video-only: create a new stream without audio tracks
			stream = new MediaStream(sourceStream.getVideoTracks());
			mimeType = WEBM_MIME_TYPES_V.find(t => MediaRecorder.isTypeSupported(t));
		} else if (!hasAudio) {
			mimeType = WEBM_MIME_TYPES_V.find(t => MediaRecorder.isTypeSupported(t));
		}

		chunksRef.current = [];
		const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
		recorder.onerror = (e) => {
			setMetadata(prev => ({
				...prev,
				recording: false,
				actionError: `Recording error: ${e.error.name}`,
			}));
		}
		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) {
				chunksRef.current.push(e.data);
			}
		};
		recorder.onstop = () => {
			setMetadata(prev => ({ ...prev, recording: false }));
			const blob = new Blob(chunksRef.current, {
				type: mimeType ?? 'video/webm',
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			const ts = new Date().toISOString().replace(/[:.]/g, '-');
			a.href = url;
			a.download = `${cameraName}_${ts}.webm`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			chunksRef.current = [];
		};
		recorder.start();
		recorderRef.current = recorder;

		return () => {
			if (recorderRef.current && recorderRef.current.state !== 'inactive') {
				recorderRef.current.stop();
				setMetadata(prev => ({ ...prev, recording: false }));
			}
			recorderRef.current = null;
		};
	}, [recording, cameraName, videoRef, setMetadata]);
};
