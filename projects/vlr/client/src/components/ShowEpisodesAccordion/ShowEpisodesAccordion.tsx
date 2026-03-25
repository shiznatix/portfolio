import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AccordionGroup, Box, Theme, Typography } from '@mui/joy';
import { accordionDetailsClasses } from '@mui/joy/AccordionDetails';
import { accordionSummaryClasses } from '@mui/joy/AccordionSummary';
import ShowAccordion from './Components/ShowAccordion';
import SeasonViewDialog from './Dialogs/SeasonViewDialog';
import { sortArrayByKey } from '../../functions';
import { BaseEpisode, FsEpisode, ShowEpisodes, ShowEpisodesSortBy, ShowSortBy, SortDirection } from '../../types';

export const accordionSx = {
	borderRadius: 'lg',
	marginX: 0.5,
	[`& .${accordionSummaryClasses.button}:hover`]: {
		bgcolor: 'transparent',
	},
	[`& .${accordionDetailsClasses.content}`]: {
		paddingX: 0,
		boxShadow: (theme: Theme) => `inset 0 1px ${theme.vars.palette.divider}`,
		[`&.${accordionDetailsClasses.expanded}`]: {
			paddingBlock: 0.75,
		},
	},
};

export type Season<T extends BaseEpisode> = {
	number: string;
	lastPlayedTime: number;
	maxPlayedCount: number;
	episodes: T[];
};

export type Show<T extends BaseEpisode> = {
	showName: string;
	seasonsCount: number;
	episodesCount: number;
	lastPlayedTime: number;
	maxPlayedCount: number;
	seasons: Season<T>[];
};

type IProps<T extends BaseEpisode> = {
	shows: ShowEpisodes<T>;
	showSortBy: ShowSortBy;
	showSortDirection: SortDirection;
	episodeSortBy: ShowEpisodesSortBy;
	episodeSortDirection: SortDirection;
	renderEpisode: (episode: T, index: number) => React.ReactNode;
	renderSeasonAction?: (episodes: T[]) => React.ReactElement;
	onAccordionChange?: (showName: string | null) => void;
};

function isFsEpisodes(eps: BaseEpisode[]): eps is FsEpisode[] {
	return (eps as FsEpisode[]).every(e => e.discriminator === 'fsEpisode');
}

export default function ShowEpisodesAccordion<T extends BaseEpisode>(props: IProps<T>): React.ReactElement {
	const [seasonDialogOpts, setSeasonDialogOpts] = useState<{ showName: string; seasonNumber: string } | null>(null);
	const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
	const [expandedShowName, setExpandedShowName] = useState<string | null>(null);
	const {
		shows,
		showSortBy,
		showSortDirection,
		episodeSortBy,
		episodeSortDirection,
	} = props;
	const onAccordionClick = useCallback((showName: string) => {
		setExpandedShowName(prev => prev === showName ? null : showName);
	}, []);
	const onSeasonOpenClick = useCallback((showName: string, seasonNumber: string) => {
		setSeasonDialogOpts({
			showName,
			seasonNumber,
		});
		setSeasonDialogOpen(true);
	}, []);
	const accordionShows = useMemo(() => {
		const shows: Show<T>[] = [];
		const seasonSortKey = showSortBy === 'maxPlayedCount' ? 'maxPlayedCount'
			: showSortBy === 'lastPlayedTime' ? 'lastPlayedTime'
			: 'number';
		const showSortKey = showSortBy === 'episodesCount' ? 'episodesCount'
			: showSortBy === 'seasonsCount' ? 'seasonsCount'
			: showSortBy === 'maxPlayedCount' ? 'maxPlayedCount'
			: showSortBy === 'lastPlayedTime' ? 'lastPlayedTime'
			: 'showName';

		for (const [showName, showSeasons] of Object.entries(props.shows)) {
			const seasons: Season<T>[] = [];

			for (const [seasonNumber, episodes] of Object.entries(showSeasons)) {
				let episodeSortKey: keyof T = 'episodeNumber';
				let lastPlayedTime = 0;
				let maxPlayedCount = 0;

				if (isFsEpisodes(episodes)) {
					const sortedPlayTime = sortArrayByKey(episodes, 'lastPlayedTime');
					const sortedPlayedCount = sortArrayByKey(episodes, 'playedCount');

					lastPlayedTime = sortedPlayTime[sortedPlayTime.length - 1]?.lastPlayedTime || 0;
					maxPlayedCount = sortedPlayedCount[sortedPlayedCount.length - 1]?.playedCount || 0;
					episodeSortKey = (episodeSortBy === 'playedCount' ? 'playedCount'
						: episodeSortBy === 'lastPlayedTime' ? 'lastPlayedTime'
						: episodeSortBy === 'episodeName' ? 'episodeName'
						: 'episodeNumber') as keyof T;
				}

				sortArrayByKey(episodes, episodeSortKey, x => x, true);
				if (episodeSortDirection === 'desc') {
					episodes.reverse();
				}

				seasons.push({
					episodes,
					number: seasonNumber,
					lastPlayedTime,
					maxPlayedCount,
				});
			}

			sortArrayByKey(seasons, seasonSortKey, x => x, true);
			if (showSortDirection === 'desc') {
				seasons.reverse();
			}

			const lastPlayedTime = seasons.reduce((acc, season) => Math.max(acc, season.lastPlayedTime), 0);
			const maxPlayedCount = seasons.reduce((acc, season) => Math.max(acc, season.maxPlayedCount), 0);

			shows.push({
				showName,
				seasons,
				seasonsCount: seasons.length,
				episodesCount: seasons.reduce((acc, season) => acc + season.episodes.length, 0),
				lastPlayedTime,
				maxPlayedCount,
			});
		}

		sortArrayByKey(shows, showSortKey, x => x, true);

		if (showSortBy === 'showName') {
			if (showSortDirection === 'asc') {
				shows.reverse();
			}
		} else if (showSortDirection === 'desc') {
			shows.reverse();
		}

		return shows;
	}, [shows, showSortDirection, showSortBy, episodeSortDirection, episodeSortBy]);

	useEffect(() => {
		if (props.onAccordionChange) {
			props.onAccordionChange(expandedShowName);
		}
	}, [expandedShowName]);

	return (
		<Box sx={{
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
		}}>
			<Box sx={{ flex: 1, overflowY: 'auto' }}>
				{accordionShows.length === 0 &&
					<Typography level="h3" textAlign="center">
						No shows/episodes found!
					</Typography>
				}
				{accordionShows.length > 0 &&
					<AccordionGroup
						variant="outlined"
						sx={accordionSx}
					>
						{accordionShows.map(show => (
							<ShowAccordion
								key={show.showName}
								expanded={expandedShowName === show.showName || accordionShows.length === 1}
								show={show}
								onAccordionClick={onAccordionClick}
								onSeasonOpenClick={onSeasonOpenClick}
								renderEpisode={props.renderEpisode}
								renderSeasonAction={props.renderSeasonAction}
							/>
						))}
					</AccordionGroup>
				}
			</Box>

			<SeasonViewDialog
				open={seasonDialogOpen}
				showName={seasonDialogOpts?.showName || ''}
				seasonNumber={seasonDialogOpts?.seasonNumber || ''}
				onClose={() => setSeasonDialogOpen(false)}
			/>
		</Box>
	);
}
