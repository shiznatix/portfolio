import IconPicInPicExit from '@mui/icons-material/FeaturedVideo';
import IconFullscreen from '@mui/icons-material/FitScreen';
import IconFullscreenExit from '@mui/icons-material/FullscreenExit';
import IconMove from '@mui/icons-material/OpenWith';
import IconPause from '@mui/icons-material/PauseCircle';
import IconPicInPic from '@mui/icons-material/PictureInPictureAlt';
import IconPlay from '@mui/icons-material/PlayCircle';
import IconToggleControls from '@mui/icons-material/VideoSettings';
import Box from '@mui/material/Box';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import React from 'react';

import {
	useCameraContext,
	useControlsExpanded,
	useFullscreen,
	usePaused,
	usePictureInPicture,
} from '../../contexts/context';

interface ControlsOverlayProps {
	opacity: number;
}

const ControlsOverlay: React.FC<ControlsOverlayProps> = (props) => {
	const paused = usePaused();
	const controlsExpanded = useControlsExpanded();
	const fullscreen = useFullscreen();
	const picInPic = usePictureInPicture();
	const { setMetadata, setUiState } = useCameraContext();

	const buttonProps: IconButtonProps = {
		size: 'small',
		color: 'default',
		sx: {
			opacity: props.opacity,
			bgcolor: 'primary.opaqueDark',
			'&:hover': { bgcolor: 'primary.main' },
		},
	};

	return (
		<Box>
			<IconButton
				size="medium"
				color={controlsExpanded ? 'primary' : 'default'}
				sx={{
					...buttonProps.sx,
					opacity: 0.8,
					bgcolor: controlsExpanded ? 'primary.opaque' : 'primary.opaqueDark',
				}}
				onClick={() => setUiState(prev => ({
					...prev,
					controlsExpanded: !prev.controlsExpanded,
				}))}
			>
				<IconToggleControls sx={{
					transform : `rotate(${controlsExpanded ? '180' : '0'}deg)`,
					transition: 'all 0.5s ease',
				}}  />
			</IconButton>

			<Stack
				direction="column"
				spacing={1}
				sx={{
					position: 'absolute',
					right: 6,
					top: controlsExpanded ? 48 : 20,
					opacity: controlsExpanded ? 1 : 0,
					transition: 'all 0.5s ease',
					pointerEvents: controlsExpanded ? 'auto' : 'none',
					marginLeft: 'auto',
					width: 'max-content',
				}}
			>
				<IconButton
					{...buttonProps}
					onClick={() => setUiState(prev => ({ ...prev, paused: !prev.paused }))}
				>
					{paused ? <IconPlay /> : <IconPause />}
				</IconButton>

				<IconButton
					{...buttonProps}
					onClick={() => setMetadata(prev => ({ ...prev, fullscreen: !prev.fullscreen }))}
				>
					{fullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
				</IconButton>

				{picInPic !== null &&
					<IconButton
						{...buttonProps}
						disabled={paused}
						onClick={() => setMetadata(prev => ({ ...prev, picInPic: !prev.picInPic }))}
					>
						{picInPic ? <IconPicInPicExit /> : <IconPicInPic />}
					</IconButton>
				}

				<IconButton
					{...buttonProps}
					disabled={fullscreen}
				>
					<IconMove className="drag-handle" />
				</IconButton>
			</Stack>
		</Box>
	);
};

export default ControlsOverlay;
