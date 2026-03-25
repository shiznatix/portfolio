import React from 'react';
import { Box } from '@mui/joy';
import Random from './Random/Random';
import Browse from './Browse/Browse';
import Status from './Status/Status';
import Downloads from './Downloads/Downloads';
import FsEpisodes from './FsEpisodes/FsEpisodes';

export default function MainView(): React.ReactElement {
	{/* TODO something that knows when each of these views should be open
	We don't want to do a conditional render here because we don't want to lose our state in each when
	it goes out of view */}
	return (
		<Box sx={{
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
		}}>
			<Box sx={{ flex: 1, overflowY: 'auto' }}>
				<Random />
				<Browse />
				<Status />
				<Downloads />
				<FsEpisodes />
			</Box>
		</Box>
	);
}
