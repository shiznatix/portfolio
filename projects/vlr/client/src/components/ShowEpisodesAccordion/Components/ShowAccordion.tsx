import React, { useCallback, useState } from 'react';
import { Accordion, AccordionDetails, AccordionGroup, AccordionSummary, Box, Typography } from '@mui/joy';
import { BaseEpisode } from '../../../types';
import { Show, accordionSx } from '../ShowEpisodesAccordion';
import SeasonAccordion from './SeasonAccordion';
import AccordionChips from './AccordionChips';

type IProps<T extends BaseEpisode> = {
	expanded: boolean;
	show: Show<T>;
	onAccordionClick: (showName: string) => void;
	onSeasonOpenClick: (showName: string, seasonNumber: string) => void;
	renderEpisode: (episode: T, index: number) => React.ReactNode;
	renderSeasonAction?: (episodes: T[]) => React.ReactElement;
};

export default function ShowAccordion<T extends BaseEpisode>(props: IProps<T>): React.ReactElement {
	const [expandedSeasonNumber, setExpandedSeasonNumber] = useState<string | null>(null);
	const onAccordionClick = useCallback(() => {
		props.onAccordionClick(props.show.showName);
	}, []);
	const onSeasonAccordionClick = useCallback((seasonNumber: string) => {
		setExpandedSeasonNumber(prev => prev === seasonNumber ? null : seasonNumber);
	}, []);
	
	return (
		<Accordion
			expanded={props.expanded}
			onChange={onAccordionClick}
		>
			<AccordionSummary>
				<Box>
					<Typography level="title-sm">{props.show.showName}</Typography>
					<AccordionChips
						episodesCount={props.show.episodesCount}
						lastPlayedTime={props.show.lastPlayedTime}
						maxPlayedCount={props.show.maxPlayedCount}
					/>
				</Box>
			</AccordionSummary>
			<AccordionDetails>
				<AccordionGroup
					variant="outlined"
					sx={accordionSx}
				>
					{props.expanded && props.show.seasons.map(season => (
						<SeasonAccordion
							key={season.number}
							expanded={expandedSeasonNumber === season.number || props.show.seasons.length === 1}
							showName={props.show.showName}
							season={season}
							onAccordionClick={onSeasonAccordionClick}
							onSeasonOpenClick={props.onSeasonOpenClick}
							renderEpisode={props.renderEpisode}
							renderSeasonAction={props.renderSeasonAction}
						/>
					))}
				</AccordionGroup>
			</AccordionDetails>
		</Accordion>
	);
}