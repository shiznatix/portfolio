import IconMenu from '@mui/icons-material/MoreVert';
import IconRecordStop from '@mui/icons-material/StopCircle';
import IconRecord from '@mui/icons-material/VideoCameraBack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup, { ButtonGroupProps } from '@mui/material/ButtonGroup';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { keyframes } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';

import {
	useCameraContext,
	useCameraName,
	useContainerRef,
	useMetadataExpanded,
	usePaused,
	useRecording,
	useStreamType} from '../../contexts/context';
import CameraMenu from './CameraMenu';
import ControlsOverlay from './ControlsOverlay';
import MetadataOverlay from './MetadataOverlay';

const spinBorder = keyframes`
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
`;

const RecordButton: React.FC = () => {
	const paused = usePaused();
	const recording = useRecording();
	const { setMetadata } = useCameraContext();
	const [elapsedSeconds, setElapsedSeconds] = useState(0);

	useEffect(() => {
		if (!recording) {
			setElapsedSeconds(0);
			return;
		}

		const intervalId = setInterval(() => {
			setElapsedSeconds(prev => prev + 1);
		}, 1000);

		return () => clearInterval(intervalId);
	}, [recording]);

	if (recording) {
		return (
			<Button
				size="medium"
				color="error"
				variant="contained"
				startIcon={<IconRecordStop />}
				onClick={() => setMetadata(prev => ({ ...prev, recording: !prev.recording }))}
				sx={{
					ml: 3,
					bgcolor: 'error.opaque',
				}}
			>
				{elapsedSeconds}
			</Button>
		);
	}

	return (
		<IconButton
			size="medium"
			color="error"
			disabled={paused}
			onClick={() => setMetadata(prev => ({ ...prev, recording: !prev.recording }))}
			sx={{
				ml: 3,
				color: 'error.opaque',
				bgcolor: 'transparent',
				position: 'relative',
				'&::before': {
					content: '""',
					position: 'absolute',
					inset: 0,
					borderRadius: 'inherit',
					border: (theme) => `3px dashed ${theme.palette.error.opaqueDark}`,
					pointerEvents: 'none',
				},
				'&:hover': {
					color: 'error.light',
				},
				'&:hover::before': {
					border: (theme) => `3px dashed ${theme.palette.error.opaque}`,
					animation: `${spinBorder} 3s linear infinite`,
				},
			}}
		>
			<IconRecord />
		</IconButton>
	);
};

const SIZE_SLIM = 0;
const SIZE_COMPACT = 1;
const SIZE_FULL = 2;
type Size = typeof SIZE_SLIM | typeof SIZE_COMPACT | typeof SIZE_FULL;

const PrimaryOverlay: React.FC = () => {
	const [measureCurrent, setMeasureCurrent] = useState<HTMLDivElement | null>(null);
	const [size, setSize] = useState<Size>(SIZE_FULL);
	const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

	// Get data from context
	const containerRef = useContainerRef();
	const cameraName = useCameraName();
	const paused = usePaused();
	const streamType = useStreamType();
	const metadataExpanded = useMetadataExpanded();
	const { setUiState } = useCameraContext();

	const opacity = paused ? 1 : 0.75;
	const variant = (paused ? 'outlined' : 'contained') as 'outlined' | 'contained';
	const buttonGroupProps: ButtonGroupProps = {
		color: 'primary',
		size: 'small',
		variant,
		sx: { opacity },
	};

	useEffect(() => {
		if (!containerRef.current || !measureCurrent) {
			return;
		}

		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const handleResize = () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			timeoutId = setTimeout(() => {
				if (containerRef.current && measureCurrent) {
					const currentWidth = measureCurrent.scrollWidth;
					const parentWidth = containerRef.current.clientWidth;
					let wantSize: Size = parentWidth <= 250
						? SIZE_SLIM
						: parentWidth <= 300
							? SIZE_COMPACT
							: SIZE_FULL;

					if (wantSize === size && currentWidth < parentWidth) {
						wantSize = Math.max(0, wantSize - 1) as Size;
					}

					if (wantSize !== size) {
						setSize(wantSize);
					}
				}
			}, 1000);
		};

		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(containerRef.current);

		return () => {
			resizeObserver.disconnect();
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [containerRef.current, measureCurrent, size]);

	useEffect(() => {
		if (metadataExpanded && size <= SIZE_SLIM) {
			setUiState(prev => ({ ...prev, metadataExpanded: false }));
		}
	}, [metadataExpanded, size, setUiState]);

	return (
		<Box
			ref={setMeasureCurrent}
			sx={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: '100%',
				height: '100%',
				zIndex: 10,
				pointerEvents: 'none',
			}}
		>
			<Stack
				direction="row"
				spacing={size >= SIZE_COMPACT ? 0.75 : 0}
				useFlexGap
				sx={{
					marginTop: 0.5,
					marginX: size >= SIZE_COMPACT ? 0.5 : 0,
					pointerEvents: 'auto',
				}}
			>
                <ButtonGroup {...buttonGroupProps}>
                    <Button
                        onClick={() => setUiState(prev => ({ ...prev, paused: !prev.paused }))}
                    >
                        {size >= SIZE_COMPACT && cameraName}
                    </Button>
                    <Button
                        onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                        sx={{ minWidth: 'auto', px: 1, borderColor: 'primary.dark' }}
                    >
                        <IconMenu />
                    </Button>
                </ButtonGroup>

                <CameraMenu anchorEl={menuAnchorEl} onClose={() => setMenuAnchorEl(null)} />

				{streamType === 'rtcpeer' &&
					<RecordButton />
				}

				<Box sx={{
					flexGrow: 1,
				}} />

                {!paused && size >= SIZE_COMPACT &&
				    <MetadataOverlay opacity={opacity} />
                }

				<ControlsOverlay opacity={opacity} />
			</Stack>
		</Box>
	);
};

export default PrimaryOverlay;
