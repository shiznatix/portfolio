import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Box, ButtonGroup, Grid, IconButton, ListDivider, ListItem, ListItemButton, ListItemContent, Stack, Typography } from '@mui/joy';
import WebStoriesIcon from '@mui/icons-material/WebStories';
import NotificationsPausedIcon from '@mui/icons-material/NotificationsPaused';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ConnectWithoutContactIcon from '@mui/icons-material/ConnectWithoutContact';
import ShowEpisodesAccordion from '../../../ShowEpisodesAccordion/ShowEpisodesAccordion';
import TorrentSelectDialog from '../Dialogs/TorrentSelectDialog';
import Loadable from '../../../Loadable';
import ConfirmButton from '../../../ConfirmButton';
import LogsDialog from '../Dialogs/LogsDialog';
import SortShowEpisodes from '../../../ShowEpisodesAccordion/SortShowEpisodes';
import FilterButton from '../../../FilterButton';
import FlexChip from '../../../FlexChip';
import { ApiContext } from '../../../../context';
import { padZero } from '../../../../functions';
import { FilterGroupValue, MissingEpisodeListItem, ShowEpisodes, SortDirection, ShowSortBy } from '../../../../types';
import * as api from '../../../../api';
import DividerLine from '../../../DividerLine';

type Shows = ShowEpisodes<MissingEpisodeListItem>;
type Filters = {
	withTorrents: FilterGroupValue;
	alreadySelected: FilterGroupValue;
	withSeeders: FilterGroupValue;
	includeIgnored: FilterGroupValue;
};

type IProps = {
	open: boolean;
};

type IPropsEpisodeListItem = {
	episode: MissingEpisodeListItem;
	onClick: () => void;
	onLogsClick: () => void;
	handleIgnore: () => void;
};

function EpisodeListItem(props: IPropsEpisodeListItem) {
	return (
		<>
			<ListItem>
				<ListItemButton onClick={props.onClick}>
					<ListItemContent>
						<Typography level="body-md">
							{padZero(props.episode.episodeNumber)} - {props.episode.episodeName}
						</Typography>
							<Stack direction="row" flexWrap="wrap">
								<FlexChip size="sm">
									Torrents: {props.episode.torrents.length}
								</FlexChip>
								<FlexChip size="sm">
									Seeders: {props.episode.torrents.reduce((acc, curr) => acc + curr.seeders, 0)}
								</FlexChip>
							</Stack>
					</ListItemContent>
				</ListItemButton>

				<ButtonGroup
					orientation="vertical"
					size="sm"
				>
					{props.episode.logs.length > 0 &&
						<IconButton onClick={props.onLogsClick}>
							<WebStoriesIcon />
						</IconButton>
					}
					<ConfirmButton
						onConfirm={props.handleIgnore}
						icon={<NotificationsPausedIcon />}
					/>
				</ButtonGroup>
			</ListItem>
			<ListDivider />
		</>
	);
}

export default function MissingEpisodes(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [allShows, setAllShows] = useState<Shows>({});
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
	const [sortBy, setSortBy] = useState<ShowSortBy>('showName');
	const [selectedEpisode, setSelectedEpisode] = useState<MissingEpisodeListItem | null>(null);
	const [filters, setFilters] = useState<Filters>({
		withTorrents: 'yes',
		alreadySelected: 'no',
		withSeeders: 'yes',
		includeIgnored: 'no',
	});
	const [logsEpisode, setLogsEpisode] = useState<MissingEpisodeListItem | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const filteredShows = useMemo(() => {
		const shows: Shows = {};
		const passesFilter = (val: FilterGroupValue, matches: boolean) => {
			if (val !== 'both') {
				if (val === 'yes' && !matches) {
					return false;
				} else if (val === 'no' && matches) {
					return false;
				}
			}

			return true;
		};

		for (const [showName, seasons] of Object.entries(allShows)) {
			const show = shows[showName] || {};

			for (const [seasonNumber, episodes] of Object.entries(seasons)) {
				const season = show[seasonNumber] || [];
				const filtered: MissingEpisodeListItem[] = [];

				for (const ep of episodes) {
					const filterResults = [
						passesFilter(filters.withTorrents, ep.torrents.length > 0),
						passesFilter(filters.alreadySelected, !!ep.torrents.find(t => t.transmissionId)),
						passesFilter(filters.withSeeders, !!ep.torrents.find(t => t.seeders > 0)),
						passesFilter(filters.includeIgnored, ep.ignore),
					];

					if (filterResults.every(r => r)) {
						filtered.push(ep);
					}
				}

				if (filtered.length) {
					season.push(...filtered);

					if (!show[seasonNumber]) {
						show[seasonNumber] = season;
					}
				}
			}

			if (Object.keys(show).length) {
				shows[showName] = show;
			}
		}

		return shows;
	}, [allShows, filters]);
	const fetchMissingEpisodes = () => {
		apiCall(setIsLoading, async () => {
			const res = await api.missingEpisodes();
			const shows: Shows = {};

			for (const mep of res) {
				let { showName, seasonNumber } = mep.imdbEpisode;
				seasonNumber = seasonNumber || '0';

				shows[showName] = shows[showName] || {};
				shows[showName][seasonNumber] = shows[showName][seasonNumber] || [];
				shows[showName][seasonNumber].push({
					...mep.imdbEpisode,
					ignore: mep.ignore,
					torrents: mep.torrents,
					logs: mep.logs,
				});
			}

			setAllShows(shows);
		});
	};
	const setFilterValue = (key: keyof Filters, val: FilterGroupValue) => setFilters({
		...filters,
		[key]: val,
	});
	const handleEpisodeIgnore = (episode: MissingEpisodeListItem) => {
		apiCall(async () => {
			await api.ignoreMissingEpisode(episode.id, true);
			fetchMissingEpisodes();
		});
	};
	const handleSeasonIgnore = (episodes: MissingEpisodeListItem[]) => {
		apiCall(async () => {
			await Promise.all(episodes.map(episode => api.ignoreMissingEpisode(episode.id, true)));
			fetchMissingEpisodes();
		});
	};
	const handleTorrentSelect = (episodeId: number, torrentId: number) => {
		apiCall(async () => {
			await api.selectTorrent({
				episodeId,
				torrentId,
			});
			fetchMissingEpisodes();
		});
	};
	const filterButtons = Object.entries(filters).map(([f, v]) => ({
		key: f as keyof Filters,
		value: v,
		icon: f === 'withTorrents' ? <WebStoriesIcon />
			: f === 'alreadySelected' ? <TaskAltIcon />
			: f === 'withSeeders' ? <ConnectWithoutContactIcon />
			: <NotificationsPausedIcon />,
		label: f === 'withTorrents' ? 'Torrents'
			: f === 'alreadySelected' ? 'Selected'
			: f === 'withSeeders' ? 'Seeders'
			: 'Ignored',
	}));

	useEffect(() => {
		if (props.open) {
			fetchMissingEpisodes();
		}
	}, [props.open]);

	return (
		<Box sx={{ height: '100%' }}>
			<Grid
				container
				sx={{
					padding: 0.5,
				}}
			>
				{filterButtons.map(b =>
					<Grid
						key={b.key}
						xs={3}
						sx={{
							display: 'flex',
							justifyContent: 'center',
						}}
					>
						<FilterButton
							value={b.value}
							badgeInset="5%"
							onChange={val => setFilterValue(b.key, val)}
						>
							<Typography>{b.icon}</Typography>
							<Typography
								level="body-xs"
								sx={{
									display: 'flex',
									alignItems: 'center',
								}}
							>
								{b.label}
							</Typography>
						</FilterButton>
					</Grid>
				)}
			</Grid>

			<Box sx={{ paddingX: 1 }}>
				<SortShowEpisodes
					buttonFlex={1}
					by={sortBy}
					direction={sortDirection}
					options={['showName', 'episodesCount', 'seasonsCount']}
					onByChange={setSortBy}
					onDirectionChange={setSortDirection}
				/>
			</Box>

			<DividerLine />

			<Box sx={{ flex: 1 }}>
				<Loadable loading={isLoading}>
					<ShowEpisodesAccordion
						shows={filteredShows}
						showSortBy={sortBy}
						showSortDirection={sortDirection}
						episodeSortBy="episodeNumber"
						episodeSortDirection="desc"
						renderEpisode={ep =>
							<EpisodeListItem
								key={ep.id}
								episode={ep}
								onClick={() => setSelectedEpisode(ep)}
								onLogsClick={() => setLogsEpisode(ep)}
								handleIgnore={() => handleEpisodeIgnore(ep)}
							/>
						}
						renderSeasonAction={eps =>
							<ConfirmButton
								onConfirm={() => handleSeasonIgnore(eps)}
								disabled={eps.length === 0}
								icon={<NotificationsPausedIcon />}
								size="sm"
								variant="soft"
							/>
						}
					/>
				</Loadable>
			</Box>

			<TorrentSelectDialog
				open={!!selectedEpisode}
				episode={selectedEpisode}
				onClose={() => setSelectedEpisode(null)}
				onSelect={handleTorrentSelect}
			/>

			<LogsDialog
				open={!!logsEpisode}
				logs={logsEpisode?.logs || []}
				onClose={() => setLogsEpisode(null)}
			/>
		</Box>
	);
}
