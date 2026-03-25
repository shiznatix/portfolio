import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import IconResize from '@mui/icons-material/ChevronLeft';
import Box from '@mui/material/Box';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GridLayout, {
	Layout,
	LayoutItem,
	// noCompactor,
	useContainerWidth,
} from 'react-grid-layout';

import { CameraContextProvider } from '../contexts/context';
import * as store from '../hooks/local-storage';
import { CameraConfig, CameraUiState } from '../types';
import Camera from './Camera';

interface GridCameraItemProps {
	config: CameraConfig;
	initialUiState: CameraUiState;
	onCardSettingsChange: (uiState: Partial<CameraUiState>) => void;
}
const GridCameraItem: React.FC<GridCameraItemProps> = React.memo(({ config, initialUiState, onCardSettingsChange }) => {
	return (
		<Box sx={{ width: '100%', height: '100%' }}>
			<CameraContextProvider config={config} initialUiState={initialUiState}>
				<Camera onCardSettingsChange={onCardSettingsChange} />
			</CameraContextProvider>
		</Box>
	);
});

type LayoutGridItem = {
	key: string;
	gridLayout: LayoutItem;
	cameraConfig: CameraConfig;
	cameraUiState: CameraUiState;
};

interface CamerasGridProps {
	cameraConfigs: CameraConfig[];
}

const CamerasGrid: React.FC<CamerasGridProps> = ({ cameraConfigs }) => {
	const { width, containerRef, mounted } = useContainerWidth();
	const [camSettings, setCamSettings] = useState<Record<string, CameraUiState>>(
		() => store.getCameraSettings(),
	);
	const [layoutGridItems, setLayoutGridItems] = useState<LayoutGridItem[]>([]);

	const camSettingsRef = useRef(camSettings);
	camSettingsRef.current = camSettings;

	const updateCameraSettings = (camKey: string, uiState: CameraUiState) => {
		store.setCameraSettings(camKey, uiState);
		setCamSettings(prev => ({ ...prev, [camKey]: uiState }));
	};

	const onLayoutChange = (layout: Layout) => {
		for (const grid of layout) {
			updateCameraSettings(grid.i, {
				...store.makeCameraSettings(camSettings[grid.i]),
				position: {
					x: grid.x,
					y: grid.y,
					w: grid.w,
					h: grid.h,
				},
			});
		}
	};

	const windowSize =
		window.innerWidth < 600 ? 'sm'
		: window.innerWidth < 1000 ? 'md'
		: 'lg';
	const cols = 12;
	const rowHeight = 32 + (8 * 2); // 32 = height of title, 8 = padding
	const defaultW = Math.floor(cols / (windowSize === 'sm' ? 1 : (windowSize === 'md' ? 2 : 3)));
	const defaultH = (windowSize === 'sm' ? 6 : (windowSize === 'md' ? defaultW - 1 : defaultW + 4));
	const makeCamGrid = (key: string, cameraUiState: CameraUiState) => {
		const containGrid = (g: Omit<LayoutItem, 'i'>) => ({
			i: key,
			x: Math.max(Math.min(g.x, cols - g.w), 0),
			y: Math.max(g.y, 0),
			w: g.w === 0
				? defaultW
				: Math.max(Math.min(g.w, cols), 3),
			h: g.h === 0
				? defaultH
				// 30 is a pretty big max height...
				: Math.max(Math.min(g.h, 30), 3),
		});

		return containGrid(cameraUiState.position);
	};
	// stable reference — reads current settings via ref to avoid stale closures
	const onCardSettingsChange = useCallback((key: string) => (uiState: Partial<CameraUiState>) => {
		const current = store.makeCameraSettings(camSettingsRef.current[key]);
		updateCameraSettings(key, {
			...current,
			...uiState,
			position: current.position,
		});
	}, []);

	useEffect(() => {
		const gridItems: LayoutGridItem[] = [];
		let x = 0;

		for (const cameraConfig of cameraConfigs) {
			const savedSettings = camSettings[cameraConfig.key];
			const cameraUiState = store.makeCameraSettings(savedSettings);
			const gridLayout = makeCamGrid(cameraConfig.key, cameraUiState);

			// if we don't have any actual config yet, we should place the cards left-to-right, top-to-bottom
			if (!savedSettings) {
				gridLayout.x = x;
				x = x + defaultW;
				x = x >= cols ? 0 : x;
			}

			gridItems.push({
				key: cameraConfig.key,
				gridLayout,
				cameraConfig,
				cameraUiState,
			});
		}

		setLayoutGridItems(gridItems);
	}, [cameraConfigs]);

	const gridChildren = useMemo(() => layoutGridItems.map(i => (
		<div key={i.key}>
			<GridCameraItem
				config={i.cameraConfig}
				initialUiState={i.cameraUiState}
				onCardSettingsChange={onCardSettingsChange(i.key)}
			/>
		</div>
	)), [layoutGridItems, onCardSettingsChange]);

	return (
		<Box ref={containerRef} sx={{ width: '100%' }}>
			{mounted &&
				<GridLayout
					width={width}
					layout={layoutGridItems.map(i => i.gridLayout)}
					gridConfig={{
						cols,
						rowHeight,
						containerPadding: [0, 0],
						margin: [0, 0],
					}}
					dragConfig={{
						enabled: true,
						handle: '.drag-handle',
					}}
					resizeConfig={{
						enabled: true,
						handles: ['se'],
						handleComponent: (
							<IconResize
								color="action"
								sx={{
									position: 'absolute',
									bottom: 0,
									right: 0,
									transform: 'rotate(225deg) scale(3)',
									zIndex: 10,
								}}
							/>
						),
					}}
					// compactor={noCompactor}
					onDragStop={(layout) => {
						onLayoutChange(layout);
					}}
					onResizeStop={(layout) => {
						onLayoutChange(layout);
					}}
				>
					{gridChildren}
				</GridLayout>
			}
		</Box>
	);
};

export default CamerasGrid;
