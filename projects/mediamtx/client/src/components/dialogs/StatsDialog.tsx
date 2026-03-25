import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import React, { useContext, useState } from 'react';

import { CamerasStaticContext } from '../../contexts/context';
import { useFetchStatsCallback, useFetchStatsEffect } from '../../hooks/use-fetch-stats';
import { CameraConfig } from '../../types';
import { CameraStats } from '../../types';

interface StatsDialogProps {
	open: boolean;
	cameraConfig: CameraConfig;
	onClose: () => void;
}

const StatsDialog: React.FC<StatsDialogProps> = (props) => {
	const { refreshStatsMs } = useContext(CamerasStaticContext);
	const [stats, setStats] = useState<CameraStats | null>(null);
	const [statsError, setStatsError] = useState<string | null>(null);

	useFetchStatsEffect({
		paused: !props.open,
		refreshStatsMs,
		callback: useFetchStatsCallback({
			type: 'detailed',
			cameraConfig: props.cameraConfig,
			onStats: (stats) => {
				setStats(stats);
				setStatsError(null);
			},
			onError: (err) => {
				setStats(null);
				setStatsError(err.message);
			},
		}),
	});

	return (
		<Dialog open={props.open} maxWidth="lg" fullWidth>
			<DialogTitle>{props.cameraConfig.name}</DialogTitle>
			<DialogContent>
				<Box sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
					<pre>
						{JSON.stringify({ cameraConfig: props.cameraConfig, stats, statsError }, null, 2)}
					</pre>
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={props.onClose}>Close</Button>
			</DialogActions>
		</Dialog>
	);
};

export default StatsDialog;
