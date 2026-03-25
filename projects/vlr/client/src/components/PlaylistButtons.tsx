import React from 'react';
import { Button, ButtonGroup } from '@mui/joy';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import LowPriorityIcon from '@mui/icons-material/LowPriority';
import Loadable from './Loadable';
import { SetPlaylistMethod } from '../types';

type IProps = {
	disabled: boolean;
	loading: boolean;
	onClick: (method: SetPlaylistMethod) => void;
};

export default function PlaylistButtons(props: IProps): React.ReactElement {
	return (
		<Loadable loading={props.loading}>
			<ButtonGroup buttonFlex={1} color="primary" sx={{ height: '100%' }}>
				<Button
					disabled={props.disabled}
					onClick={() => props.onClick('append')}
					startDecorator={<LowPriorityIcon />}
					variant="soft"
					sx={{ height: '100%', width: '100%' }}
				>
					Append
				</Button>
				<Button
					disabled={props.disabled}
					onClick={() => props.onClick('replace')}
					endDecorator={<PlaylistPlayIcon />}
					variant="solid"
					sx={{ height: '100%', width: '100%' }}
				>
					Play
				</Button>
			</ButtonGroup>
		</Loadable>
	);
}
