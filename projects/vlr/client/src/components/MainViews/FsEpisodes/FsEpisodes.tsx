import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/joy';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import ShowEpisodesAccordion from '../../ShowEpisodesAccordion/ShowEpisodesAccordion';
import ConfirmButton from '../../ConfirmButton';
import Loadable from '../../Loadable';
import PlaylistButtons from '../../PlaylistButtons';
import FileListItem from '../../FileListItem/FileListItem';
import ListActions from './Components/ListActions';
import { arrayUnique, removeOrAppend, updateByValue } from '../../../functions';
import { ApiContext } from '../../../context';
import { useViewState } from '../../../state';
import { getFsEpisodesHiddenShowsProfiles, getLastFsEpisodesMutators, saveLastFsEpisodesMutators } from '../../../local-storage';
import { EpisodesMutators, FsEpisode, SetPlaylistMethod, ShowEpisodes, ShowSortBy } from '../../../types';
import * as api from '../../../api';

type Shows = ShowEpisodes<FsEpisode>;

type IPropsEpisodeListItem = {
	index: number;
	episode: FsEpisode;
	selected: boolean;
	onEpisodeClick: (episode: FsEpisode) => void;
	onUpdate: (episode: FsEpisode, newVals: Partial<FsEpisode>) => void;
}

const EpisodeListItem = React.memo((props: IPropsEpisodeListItem) => {
	return (
		<FileListItem
			key={props.episode.filePath}
			index={props.index}
			file={props.episode}
			selected={props.selected}
			onClick={() => props.onEpisodeClick(props.episode)}
			onUpdate={vals => props.onUpdate(props.episode, vals)}
		/>
	);
});

export default function FsEpisodes(): React.ReactElement {
	const defaultMutators = useMemo(() => {
		const lastMutators = getLastFsEpisodesMutators();
		const hideShowProfiles = getFsEpisodesHiddenShowsProfiles();
		const { hiddenShowsProfileName } = lastMutators;
		const hiddenShowNames = hideShowProfiles.find(p => p.name === hiddenShowsProfileName)?.showNames || [];

		return {
			...lastMutators,
			hiddenShowNames,
			search: '',
		};
	}, []);
	const apiCall = useContext(ApiContext);
	const viewKey = useViewState(state => state.viewKey);
	const [allEpisodes, setAllEpisodes] = useState<FsEpisode[]>([]);
	const [mutators, setMutators] = useState<EpisodesMutators>(defaultMutators);
	const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const open = viewKey === 'fsEpisodes';
	const shows = useMemo(() => {
		const shows: Shows = {};
		const res = allEpisodes.filter(e => {
			if (mutators.seen === 'yes' && !e.playedCount) {
				return false;
			} else if (mutators.seen === 'no' && e.playedCount > 0) {
				return false;
			}

			if (mutators.autoDownloaded === 'yes' && !e.autoDownloaded) {
				return false;
			} else if (mutators.autoDownloaded === 'no' && e.autoDownloaded === true) {
				return false;
			}

			if (mutators.includeInRandom === 'yes' && e.skipInRandom === true) {
				return false;
			} else if (mutators.includeInRandom === 'no' && !e.skipInRandom) {
				return false;
			}
			
			if (mutators.starred === 'yes' && !e.starred) {
				return false;
			} else if (mutators.starred === 'no' && e.starred === true) {
				return false;
			}

			if (mutators.search) {
				const showName = e.showName.toLowerCase();
				const epName = e.episodeName?.toLowerCase() || '';
				return showName.includes(mutators.search) || epName.includes(mutators.search);
			}
			if (mutators.hiddenShowNames.length > 0) {
				return !mutators.hiddenShowNames.includes(e.showName);
			}

			return true;
		});
		
		for (const ep of res) {
			let { showName, seasonNumber } = ep;
			seasonNumber = seasonNumber || '0';
			
			shows[showName] = shows[showName] || {};
			shows[showName][seasonNumber] = shows[showName][seasonNumber] || [];
			shows[showName][seasonNumber].push(ep);
		}

		return shows;
	}, [mutators.seen, mutators.autoDownloaded, mutators.includeInRandom, mutators.starred, mutators.search, mutators.hiddenShowNames, allEpisodes]);
	const searchOptions = useMemo(() => {
		return arrayUnique([
			...allEpisodes.map(e => e.showName),
			...allEpisodes.map(e => e.episodeName).filter(e => e),
		]);
	}, [allEpisodes]);
	const allShowNames = useMemo(() => {
		return arrayUnique(allEpisodes.map(e => e.showName)).sort();
	}, [allEpisodes]);
	const showSortBy: ShowSortBy = mutators.episodeSortBy === 'lastPlayedTime' ? 'lastPlayedTime'
		: mutators.episodeSortBy === 'playedCount' ? 'maxPlayedCount'
		: mutators.episodeSortBy === 'episodeNumber' ? 'episodesCount'
		: 'showName';

	const onMutatorsChange = useCallback((vals: Partial<EpisodesMutators>) => {
		setMutators(mutators => ({
			...mutators,
			...vals,
		}));
	}, []);
	const onEpisodeClick = useCallback((episode: FsEpisode) => {
		setSelectedPaths(selectedPaths => removeOrAppend(selectedPaths, episode.filePath));
	}, []);
	const onEpisodeUpdate = useCallback((episode: FsEpisode, newVals: Partial<FsEpisode>) => {
		setAllEpisodes(allEpisodes => updateByValue(allEpisodes, newVals, e => e.filePath === episode.filePath));
	}, []);
	const onPlaylistActionClick = useCallback((action: SetPlaylistMethod) => apiCall(async () => {
		await api.setPlaylistPaths(selectedPaths, action);
		setSelectedPaths([]);
	}), [selectedPaths]);
	const handleSeasonIgnore = useCallback((episodes: FsEpisode[]) => apiCall(async () => {
		const filePaths = episodes.map(ep => ep.filePath);

		await Promise.all(filePaths.map(f => api.setXAttrValue(f, 'skipInRandom', '0')));
		setAllEpisodes(allEpisodes => {
			return updateByValue(allEpisodes, {
				skipInRandom: false,
			}, f => filePaths.includes(f.filePath));
		});
	}), []);
	
	useEffect(() => {
		if (open) {
			apiCall(setIsLoading, async () => {
				const fsEpisodes = await api.fsEpisodes();
				
				setAllEpisodes(fsEpisodes);
				setSelectedPaths([]);
			})
		}
	}, [open]);
	useEffect(() => {
		saveLastFsEpisodesMutators(mutators);
	}, [mutators]);
	useEffect(() => {
		setSelectedPaths([]);
	}, [shows])

	return (
		<Box
			hidden={!open}
			sx={{
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<Box sx={{ paddingY: 1 }}>
				<ListActions
					mutators={mutators}
					searchOptions={searchOptions}
					allShowNames={allShowNames}
					onMutatorsChange={onMutatorsChange}
				/>
			</Box>

			<Box sx={{
				flex: 1,
				overflowY: 'auto',
			}}>
				<Loadable loading={isLoading}>
					<ShowEpisodesAccordion
						shows={shows}
						showSortBy={showSortBy}
						showSortDirection={mutators.episodeSortDirection}
						episodeSortBy={mutators.episodeSortBy}
						episodeSortDirection={mutators.episodeSortDirection}
						renderEpisode={(ep, i) =>
							<EpisodeListItem
								key={ep.filePath}
								index={i}
								episode={ep}
								selected={selectedPaths.includes(ep.filePath)}
								onEpisodeClick={onEpisodeClick}
								onUpdate={onEpisodeUpdate}
							/>
						}
						renderSeasonAction={eps =>
							<ConfirmButton
								onConfirm={() => handleSeasonIgnore(eps)}
								disabled={eps.length === 0}
								icon={<ShuffleIcon />}
								label="on"
								defaultColor="success"
								variant="soft"
								size="sm"
							/>
						}
					/>
				</Loadable>
			</Box>

			<Box sx={{ height: '10%' }}>
				<PlaylistButtons
					disabled={selectedPaths.length === 0}
					loading={false}
					onClick={onPlaylistActionClick}
				/>
			</Box>
		</Box>
	);
}
