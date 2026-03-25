import React, { useCallback } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, List, ListSubheader, Typography, useTheme } from '@mui/joy';
import SourceIcon from '@mui/icons-material/Source';
import { padZero } from '../../../functions';
import { BaseEpisode } from '../../../types';
import { Season } from '../ShowEpisodesAccordion';
import AccordionChips from './AccordionChips';

type IProps<T extends BaseEpisode> = {
	expanded: boolean;
	showName: string;
	season: Season<T>;
	onAccordionClick: (seasonNumber: string) => void;
	onSeasonOpenClick: (showName: string, seasonNumber: string) => void;
	renderEpisode: (episode: T, index: number) => React.ReactNode;
	renderSeasonAction?: (episodes: T[]) => React.ReactElement;
};

export default function SeasonAccordion<T extends BaseEpisode>(props: IProps<T>): React.ReactElement {
	const theme = useTheme();
	const onAccordionClick = useCallback(() => {
		props.onAccordionClick(props.season.number);
	}, []);
	const onSeasonOpenClick = useCallback(() => {
		props.onSeasonOpenClick(props.showName, props.season.number);
	}, []);

	return (
		<Accordion
			expanded={props.expanded}
			onChange={onAccordionClick}
		>
			<AccordionSummary sx={{ backgroundColor: theme.palette.success[50] }}>
				<Box>
					<Typography level="title-sm" color="success">
						Season {padZero(props.season.number)}
					</Typography>
					<AccordionChips
						color="success"
						episodesCount={props.season.episodes.length}
						lastPlayedTime={props.season.lastPlayedTime}
						maxPlayedCount={props.season.maxPlayedCount}
					/>
				</Box>
			</AccordionSummary>
			<AccordionDetails sx={{ paddingX: 0.5 }}>
				{props.expanded &&
					<List>
						<ListSubheader>
							<Button
								size="sm"
								variant="soft"
								startDecorator={<SourceIcon />}
								onClick={onSeasonOpenClick}
								sx={{
									flexGrow: 1,
									marginRight: 1,
								}}
							>
								Open folder
							</Button>

							{props.renderSeasonAction && props.renderSeasonAction(props.season.episodes)}
						</ListSubheader>
						{props.season.episodes.map((episode, i) => props.renderEpisode(episode, i))}
					</List>
				}
			</AccordionDetails>
		</Accordion>
	);
}
