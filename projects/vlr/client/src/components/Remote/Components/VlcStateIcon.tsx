import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

type IProps = {
	state?: string | null;
};

export default function VlcStateIcon(props: IProps): React.ReactElement {
	if (props.state === 'playing') {
		return <PlayArrowIcon />;
	}
	if (props.state === 'paused') {
		return <PauseIcon />;
	}

	return <CloseIcon />;
};
