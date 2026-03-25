import React, { useMemo, useState } from 'react';
import { Box, Button } from '@mui/joy';
import SearchBar from '../../../SearchBar';
import SortShowEpisodes from '../../../ShowEpisodesAccordion/SortShowEpisodes';
import Filters from './Filters';
import HideShowNamesDialog from '../Dialogs/HideShowNamesDialog';
import { IconShowName } from '../../../Icons';
import { EpisodesMutators } from '../../../../types';

type IProps = {
	mutators: EpisodesMutators;
	allShowNames: string[];
	searchOptions: string[];
	onMutatorsChange: (vals: Partial<EpisodesMutators>) => void;
};

export default function ListActions(props: IProps): React.ReactElement {
	const [hideShowNamesDialogOpen, setHddenShowNamesDialogOpen] = useState(false);
	const onHideShowNamesChange = (hiddenShowsProfileName: EpisodesMutators['hiddenShowsProfileName'], hiddenShowNames: EpisodesMutators['hiddenShowNames']) => {
		setHddenShowNamesDialogOpen(false);
		props.onMutatorsChange({ hiddenShowsProfileName, hiddenShowNames });
	};
	const searchOptions = useMemo(() => {
		return props.mutators.search ? props.searchOptions.filter(v => v.toLowerCase().includes(props.mutators.search)) : [];
	}, [props.searchOptions, props.mutators.search]);
	const showNamesDiff = props.allShowNames.length - props.mutators.hiddenShowNames.length;
	const showNamesButtonLabel = showNamesDiff === props.allShowNames.length ? 'All' : (showNamesDiff < 0 ? 0 : showNamesDiff);

	return (
		<Box sx={{ width: '100%' }}>
			<Box sx={{
				paddingX: 1,
			}}>
				<Filters
					mutators={props.mutators}
					onChange={props.onMutatorsChange}
				/>
			</Box>

			<Box sx={{
				paddingTop: 1,
				width: '100%',
			}}>
				<SearchBar
					size="md"
					searchOptions={searchOptions}
					onSearchChange={search => props.onMutatorsChange({ search })}
				>
					<SortShowEpisodes
						size="md"
						by={props.mutators.episodeSortBy}
						direction={props.mutators.episodeSortDirection}
						options={['episodeName', 'episodeNumber', 'playedCount', 'lastPlayedTime']}
						onByChange={episodeSortBy => props.onMutatorsChange({ episodeSortBy })}
						onDirectionChange={episodeSortDirection => props.onMutatorsChange({ episodeSortDirection })}
					/>

					<Button
						color="primary"
						variant="outlined"
						startDecorator={<IconShowName />}
						onClick={() => setHddenShowNamesDialogOpen(!hideShowNamesDialogOpen)}
					>
						{showNamesButtonLabel}
					</Button>
						
					{/* <ShowVisibilitiesDropdown
						open={showNamesMenuOpen}
						onMenuButtonClick={() => setShowNamesMenuOpen(!showNamesMenuOpen)}
						allShowNames={props.allShowNames}
						mutators={props.mutators}
						onMutatorsChange={props.onMutatorsChange}
					/> */}
				</SearchBar>
			</Box>

			<HideShowNamesDialog
				open={hideShowNamesDialogOpen}
				mutators={props.mutators}
				allShowNames={props.allShowNames}
				onCancel={() => setHddenShowNamesDialogOpen(false)}
				onConfirm={onHideShowNamesChange}
			/>
		</Box>
	)
}
