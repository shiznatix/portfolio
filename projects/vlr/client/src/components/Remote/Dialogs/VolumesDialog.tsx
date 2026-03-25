import React, { useContext } from 'react';
import { Box, ButtonGroup, IconButton } from '@mui/joy';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import Dialog from '../../Dialog';
import { ApiContext } from '../../../context';
import * as api from '../../../api';
import DividerLine from '../../DividerLine';
import { config } from '../../../config';

type VolumeSource = {
	type: string;
	command: (cmd: string) => void;
};

type IProps = {
	open: boolean;
	onClose: () => void;
};

export default function VolumesDialog(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const command = (func: 'playerCommand' | 'tvCommand', cmd: string) => apiCall(async () => await api[func](cmd));
	const availableSources = config.volumeControls.length > 0 ? config.volumeControls : ['vlc'];
	const sources: VolumeSource[] = [];
	
	
	if (availableSources.includes('vlc')) {
		sources.push({
			type: 'vlc',
			command: (cmd: string) => command('playerCommand', cmd),
		});
	}

	if (availableSources.includes('tv')) {
		sources.push({
			type: 'tv',
			command: (cmd: string) => command('tvCommand', cmd),
		});
	}

	if (availableSources.includes('system')) {
		// sources.push({
		// 	type: 'system',
		// 	command: (cmd: string) => command('systemCommand', cmd),
		// });
	}

	// TODO see if we can get the current value for each control and display it here

	return (
		<Dialog.Dialog
			open={props.open}
			title="Volumes"
			cancelLabel="Close"
			onCancel={props.onClose}
		>
			{sources.map(s =>
				<Box key={s.type}>
					<DividerLine key={s.type} label={s.type.toUpperCase()} />
					
					<ButtonGroup size="lg" buttonFlex={1}>
						<IconButton
							color="danger"
							variant="soft"
							onClick={() => s.command('mute')}
							sx={{ height: '100%', width: '100%' }}
						>
							<VolumeMuteIcon />
						</IconButton>
						<IconButton
							color="warning"
							variant="soft"
							onClick={() => s.command('volume-down')}
							sx={{ height: '100%', width: '100%' }}
						>
							<VolumeDownIcon />
						</IconButton>
						<IconButton
							color="success"
							variant="soft"
							onClick={() => s.command('volume-up')}
							sx={{ height: '100%', width: '100%' }}
						>
							<VolumeUpIcon />
						</IconButton>
					</ButtonGroup>
				</Box>
			)}
		</Dialog.Dialog>
	);
}
