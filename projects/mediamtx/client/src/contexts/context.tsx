import React, { createContext, useCallback, useContext, useMemo,useRef } from 'react';

import { disablePicInPic } from '../functions';
import { CameraBrowserFlags, CameraMetadata, CameraRefs, CameraStatsSimple,CameraUiState } from '../types';
import { CameraConfig } from '../types';

// Static context for app-level configuration
type CamerasStaticContextValue = {
	refreshStatsMs: number;
	refreshStreamsMs: number;
};
export const CamerasStaticContext = createContext<CamerasStaticContextValue>({
	refreshStatsMs: 5000,
	refreshStreamsMs: 2000,
});

type CameraContextState = {
	config: CameraConfig;
	browserFlags: CameraBrowserFlags;
	metadata: CameraMetadata;
	uiState: CameraUiState;
	refs: CameraRefs;
	stats: CameraStatsSimple | null;
};

type CameraContextActions = {
	setMetadata: (updater: (prev: CameraMetadata) => CameraMetadata) => void;
	setUiState: (updater: (prev: CameraUiState) => CameraUiState) => void;
	setStats: (updater: (prev: CameraStatsSimple | null) => CameraStatsSimple | null) => void;
	subscribe: <T>(selector: (state: CameraContextState) => T, callback: (value: T) => void) => () => void;
};

type CameraContextValue = CameraContextState & CameraContextActions;

type SubscriberEntry = {
	selector: (state: CameraContextState) => unknown;
	callback: (value: unknown) => void;
	lastValue: unknown;
};

const CameraContext = createContext<CameraContextValue | null>(null);

// Default values
const defaultMetadata: CameraMetadata = {
	streamType: 'rtcpeer',
	streamStatus: 'uninstantiated',
	streamError: null,
	actionError: null,
	picInPic: null,
	fullscreen: false,
	fullscreenRef: null,
	fps: null,
	readersCount: null,
	lastFrameTime: null,
	recording: false,
};
const defaultUiState: CameraUiState = {
	paused: false,
	streamType: 'rtcpeer',
	metadataExpanded: false,
	controlsExpanded: false,
	brightness: '100%',
	position: {
		x: 0,
		y: 0,
		w: 800,
		h: 600,
	},
	statsDialogOpen: false,
	recordingsDialogOpen: false,
};
const defaultBrowserFlags: CameraBrowserFlags = {
	disablePicInPic: disablePicInPic(),
};
const defaultStats = null;

// Provider component
type CameraContextProviderProps = {
	children: React.ReactNode;
	config: CameraConfig;
	initialUiState?: Partial<CameraUiState>;
};

export function CameraContextProvider({
	children,
	config,
	initialUiState = {}
}: CameraContextProviderProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const refs: CameraRefs = {
		container: containerRef,
		video: videoRef,
	};
	const stateRef = useRef<CameraContextState>({
		config,
		browserFlags: defaultBrowserFlags,
		metadata: defaultMetadata,
		uiState: { ...defaultUiState, ...initialUiState },
		refs,
		stats: defaultStats,
	});
	const subscribersRef = useRef<Set<SubscriberEntry>>(new Set());

	const notifySubscribers = useCallback(() => {
		subscribersRef.current.forEach(subscriber => {
			const newValue = subscriber.selector(stateRef.current);
			if (newValue !== subscriber.lastValue) {
				subscriber.lastValue = newValue;
				subscriber.callback(newValue);
			}
		});
	}, []);
	const setMetadata = useCallback((updater: (prev: CameraMetadata) => CameraMetadata) => {
		const newMetadata = updater(stateRef.current.metadata);
		stateRef.current = {
			...stateRef.current,
			metadata: newMetadata,
		};
		notifySubscribers();
	}, [notifySubscribers]);
	const setUiState = useCallback((updater: (prev: CameraUiState) => CameraUiState) => {
		const newUiState = updater(stateRef.current.uiState);
		stateRef.current = {
			...stateRef.current,
			uiState: newUiState,
		};
		notifySubscribers();
	}, [notifySubscribers]);
	const setStats = useCallback((updater: (prev: CameraStatsSimple | null) => CameraStatsSimple | null) => {
		const newStats = updater(stateRef.current.stats);
		stateRef.current = {
			...stateRef.current,
			stats: newStats,
		};
		notifySubscribers();
	}, [notifySubscribers]);

	const subscribe = useCallback(<T,>(
		selector: (state: CameraContextState) => T,
		callback: (value: T) => void
	) => {
		const subscriber: SubscriberEntry = {
			selector,
			callback: callback as (value: unknown) => void,
			lastValue: selector(stateRef.current),
		};

		subscribersRef.current.add(subscriber);

		return () => {
			subscribersRef.current.delete(subscriber);
		};
	}, []);

	const value = useMemo(() => ({
		...stateRef.current,
		setMetadata,
		setUiState,
		setStats,
		subscribe,
	}), [setMetadata, setUiState, setStats, subscribe]);

	// Update value properties when state changes
	value.config = stateRef.current.config;
	value.browserFlags = stateRef.current.browserFlags;
	value.metadata = stateRef.current.metadata;
	value.uiState = stateRef.current.uiState;
	value.refs = stateRef.current.refs;
	value.stats = stateRef.current.stats;

	return (
		<CameraContext.Provider value={value}>
			{children}
		</CameraContext.Provider>
	);
}

// Hook to use the full context
export function useCameraContext() {
	const context = useContext(CameraContext);
	if (!context) {
		throw new Error('useCameraContext must be used within CameraContextProvider');
	}
	return context;
}

// Hook to subscribe to specific parts of the state
export function useCameraSelector<T>(selector: (state: CameraContextState) => T): T {
	const context = useContext(CameraContext);
	if (!context) {
		throw new Error('useCameraSelector must be used within CameraContextProvider');
	}

	const [value, setValue] = React.useState(() => selector(context));

	React.useEffect(() => {
		return context.subscribe(selector, setValue);
	}, [context, selector]);

	return value;
}

// Convenience hooks for refs
export function useCameraRefs() {
	return useCameraSelector(state => state.refs);
}

export function useContainerRef() {
	return useCameraSelector(state => state.refs.container);
}

export function useVideoRef() {
	return useCameraSelector(state => state.refs.video);
}

// Convenience hooks for config
export function useCameraConfig() {
	return useCameraSelector(state => state.config);
}

export function useCameraName() {
	return useCameraSelector(state => state.config.name);
}

export function useRtcPeerUrl() {
	return useCameraSelector(state => state.config.rtcPeerUrl);
}

export function useRecordingsUrl() {
	return useCameraSelector(state => state.config.recordingsUrl);
}

export function useStatsUrl() {
	return useCameraSelector(state => state.config.statsUrl);
}

export function useRotate() {
	return useCameraSelector(state => state.config.rotate);
}

// Combined config hooks for common use cases
export function useCameraUrls() {
	return useCameraSelector(state => ({
		rtcPeerUrl: state.config.rtcPeerUrl,
		recordingsUrl: state.config.recordingsUrl,
		statsUrl: state.config.statsUrl,
	}));
}

export function useCameraAppearance() {
	return useCameraSelector(state => ({
		name: state.config.name,
		rotate: state.config.rotate,
	}));
}

// Convenience hooks for browserFlags
export function useCameraBrowserFlags() {
	return useCameraSelector(state => state.browserFlags);
}

// Convenience hooks for metadata
export function useCameraMetadata() {
	return useCameraSelector(state => state.metadata);
}

export function useStreamStatus() {
	return useCameraSelector(state => state.metadata.streamStatus);
}

export function useStreamType() {
	return useCameraSelector(state => state.metadata.streamType);
}

export function useStreamError() {
	return useCameraSelector(state => state.metadata.streamError);
}

export function useActionError() {
	return useCameraSelector(state => state.metadata.actionError);
}

export function usePictureInPicture() {
	return useCameraSelector(state => state.metadata.picInPic);
}

export function useFullscreen() {
	return useCameraSelector(state => state.metadata.fullscreen);
}

export function useRecording() {
	return useCameraSelector(state => state.metadata.recording);
}

export function useFps() {
	return useCameraSelector(state => state.metadata.fps);
}

export function useLastFrameTime() {
	return useCameraSelector(state => state.metadata.lastFrameTime);
}

// Convenience hooks for UI state
export function useCameraUiState() {
	return useCameraSelector(state => state.uiState);
}

export function usePaused() {
	return useCameraSelector(state => state.uiState.paused);
}

export function useControlsExpanded() {
	return useCameraSelector(state => state.uiState.controlsExpanded);
}

export function useMetadataExpanded() {
	return useCameraSelector(state => state.uiState.metadataExpanded);
}

export function useBrightness() {
	return useCameraSelector(state => state.uiState.brightness);
}

// Convenience hooks for stats
export function useCameraStats() {
	return useCameraSelector(state => state.stats);
}

export function useReadersCount() {
	return useCameraSelector(state => state.stats?.readers.length ?? 0);
}

// You might also want to add a hook to check if stats are available
export function useHasStats() {
	return useCameraSelector(state => state.stats !== null);
}

// Helper hooks for stats handling
export function useStatsOrDefault<T>(selector: (stats: CameraStatsSimple) => T, defaultValue: T): T {
	return useCameraSelector(state =>
		state.stats ? selector(state.stats) : defaultValue
	);
}

export function useStatsIfAvailable<T>(selector: (stats: CameraStatsSimple) => T): T | null {
	return useCameraSelector(state =>
		state.stats ? selector(state.stats) : null
	);
}

// Combined hooks for common use cases
export function useStreamInfo() {
	return useCameraSelector(state => ({
		streamType: state.metadata.streamType,
		streamStatus: state.metadata.streamStatus,
		streamError: state.metadata.streamError,
		fps: state.metadata.fps,
		readersCount: state.stats?.readers.length ?? null,
	}));
}

export function useVideoControls() {
	return useCameraSelector(state => ({
		paused: state.uiState.paused,
		brightness: state.uiState.brightness,
		fullscreen: state.metadata.fullscreen,
		picInPic: state.metadata.picInPic,
	}));
}
