import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

import { useContainerRef, usePaused, useStreamError } from '../contexts/context';
import CameraStream from './CameraStream';
import ConnectionOverlay from './stream-overlays/ConnectionOverlay';
import PrimaryOverlay from './stream-overlays/PrimaryOverlay';

const CameraCard: React.FC = () => {
	const theme = useTheme();
	const ref = useContainerRef();
	const paused = usePaused();
	const streamError = useStreamError();

	const borderColor = !paused && streamError ? theme.palette.error.main : theme.palette.primary.main;
	const backgroundColor = alpha(borderColor, 0.1);

	return (
		<Card
			ref={ref}
			sx={{
				padding: 0,
				boxSizing: 'border-box',
				width: '100%',
				height: '100%',
				borderStyle: 'solid',
				borderRadius: 0,
				borderWidth: !paused && streamError ? 5 : 1,
				borderColor,
				backgroundColor,
			}}
		>
			<CardContent sx={{
				width: '100%',
				height: '100%',
				p: '0 !important',
			}}>
				<Box sx={{
					display: 'flex',
					width: '100%',
					height: '100%',
					overflow: 'hidden',
					justifyContent: 'center',
				}}>
					<Box sx={{
						position: 'relative',
						height: '100%',
						width: '100%',
					}}>
						<PrimaryOverlay />
						<ConnectionOverlay />
						<CameraStream />
					</Box>
				</Box>
			</CardContent>
		</Card>
	);
};

export default CameraCard;
