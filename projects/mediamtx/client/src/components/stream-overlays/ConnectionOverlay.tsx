import IconPlay from '@mui/icons-material/PlayCircle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import React from 'react';

import {
	useCameraContext,
	usePaused,
	useStreamError,
	useStreamStatus
} from '../../contexts/context';

const ConnectionOverlay: React.FC = () => {
	const { setUiState } = useCameraContext();
	const isPaused = usePaused();
	const streamError = useStreamError();
	const streamStatus = useStreamStatus();

	const isError = !!(streamError || streamStatus !== 'connected');

	return (
		<Box sx={{
			display: isPaused || isError ? 'inline' : 'none',
			zIndex: 9,
			position: 'absolute',
			left: '0px',
			height: '100%',
			width: '100%',
			backgroundColor: isPaused
				? 'transparent'
				: 'rgba(0, 0, 0, 0.5)',
		}}>
			<Box sx={{
				height: '100%',
				width: '100%',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
			}}>
				{isPaused &&
					<Button
						variant="outlined"
						size="large"
						startIcon={<IconPlay />}
						onClick={() => setUiState(prev => ({ ...prev, paused: false }))}
						sx={{
							width: '25%',
							height: '25%',
						}}
					>
						PLAY
					</Button>
				}

				{(!isPaused && isError) &&
					<Typography color="error" variant="h4" padding={2}>
						{streamError || streamStatus}
					</Typography>
				}
			</Box>
		</Box>
	);
};

export default ConnectionOverlay;
