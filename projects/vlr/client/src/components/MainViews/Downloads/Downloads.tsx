import React, { useState } from 'react';
import { Box, Tab, TabList, TabPanel, Tabs } from '@mui/joy';
import MissingEpisodes from './Components/MissingEpisodes';
import Transmission from './Components/Transmission';
import { useViewState } from '../../../state';

export default function Downloads(): React.ReactElement {
	const viewKey = useViewState(state => state.viewKey);
	const [tab, setTab] = useState('missing-episodes');
	const open = viewKey === 'downloads';
	const panelSx = {
		paddingTop: 1,
		paddingX: 0,
	};

	// TODO the TabPanel content goes under the TabList which makes the scroll bar look silly
	return (
		<Box
			hidden={!open}
			sx={{ height: '100%' }}
		>
			<Tabs
				onChange={(_, val) => setTab(val as string)}
				defaultValue="missing-episodes"
				sx={{ height: '100%' }}
			>
				<TabList sticky="top" tabFlex={1} sx={{ zIndex: 2 }}>
					<Tab
						value="missing-episodes"
						indicatorInset
						variant="soft"
						color="primary"
					>
						Episodes
					</Tab>
					<Tab
						value="transmission"
						indicatorInset
						variant="soft"
						color="primary"
					>
						Transmission
					</Tab>
				</TabList>

				<TabPanel value="missing-episodes" sx={panelSx}>
					<MissingEpisodes open={open && tab === 'missing-episodes'} />
				</TabPanel>
				<TabPanel value="transmission" sx={panelSx}>
					<Transmission open={open && tab === 'transmission'} />
				</TabPanel>
			</Tabs>
		</Box>
	);
}
