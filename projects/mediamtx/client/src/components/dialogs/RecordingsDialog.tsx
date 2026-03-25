import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import React from 'react';

import { CameraConfig } from '../../types';

interface RecordingsDialogProps {
	open: boolean;
	cameraConfig: CameraConfig;
	onClose: () => void;
}

const RecordingsDialog: React.FC<RecordingsDialogProps> = (props) => {
	return (
		<Dialog open={props.open} maxWidth="lg" fullWidth>
			<DialogTitle>{props.cameraConfig.name}</DialogTitle>
			<DialogContent>
				<Box sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
					<code>
						TODO - Use the API to get Recordings or something!
					</code>
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={props.onClose}>Close</Button>
			</DialogActions>
		</Dialog>
	);
};

export default RecordingsDialog;
