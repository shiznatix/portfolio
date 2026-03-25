import React from 'react';
import { Button, ToggleButtonGroup } from '@mui/joy';
import { ShowEpisodesSortBy, SortDirection, ShowSortBy } from '../../types';
import { IconCount, IconMaximum, IconName, IconPlayedCount, IconSeen, IconSortAsc, IconSortDesc } from '../Icons';

function sortByNode(by: ShowSortBy | ShowEpisodesSortBy): React.ReactElement | string {
	switch (by) {
		case 'showName':
			return 'Show';
		case 'seasonsCount':
			return 'Seasons';
		case 'episodesCount':
			return 'Episodes';
		case 'episodeNumber':
			return <IconCount />;
		case 'episodeName':
			return <IconName />
		case 'playedCount':
			return <IconPlayedCount />;
		case 'lastPlayedTime':
			return <IconSeen />;
		case 'maxPlayedCount':
			return <IconMaximum />;
	}
}

type IProps<T extends ShowSortBy | ShowEpisodesSortBy> = {
	direction: SortDirection;
	options?: T[];
	by?: T;
	buttonFlex?: number;
	size?: 'sm' | 'md' | 'lg';
	onByChange?: (sortBy: T) => void;
	onDirectionChange?: (sortDirection: SortDirection) => void;
};

type IPropsSortButton<T extends ShowSortBy | ShowEpisodesSortBy> = {
	by: T;
	selected: boolean;
	onClick: () => void;
};

type IPropsSortByButton = {
	direction: SortDirection;
	onClick: () => void;
};

function SortButton<T extends ShowSortBy | ShowEpisodesSortBy>(props: IPropsSortButton<T>) {
	const child = sortByNode(props.by);

	return (
		<Button
			value={props.by}
			onClick={props.onClick}
			sx={{ padding: 0.5 }}
		>
			{child}
		</Button>
	);
}

function SortByButton(props: IPropsSortByButton) {
	const sx = {
		padding: 0.5,
		transform: `rotate(${props.direction === 'asc' ? '360' : '0'}deg)`,
		transition: `0.5s ease`,
	};
	const icon = props.direction === 'asc' ? <IconSortAsc /> : <IconSortDesc />;

	return (
		<Button onClick={props.onClick} sx={sx}>
			{icon}
		</Button>
	);
}

export default function SortShowEpisodes<T extends ShowSortBy | ShowEpisodesSortBy>(props: IProps<T>): React.ReactElement {
	const size = props.size || 'sm';
	const value = props.by ? [props.by] : [];
	const flipDirection = () => {
		if (props.onDirectionChange) {
			props.onDirectionChange(props.direction === 'asc' ? 'desc' : 'asc');
		}
	};
	const onSortByClick = (newSortBy: T) => {
		if (newSortBy === props.by) {
			flipDirection();
		} else if (props.onByChange) {
			props.onByChange(newSortBy);
		}
	};

	return (
		<ToggleButtonGroup
			size={size}
			color="primary"
			value={value}
			buttonFlex={props.buttonFlex}
		>
			<SortByButton
				direction={props.direction}
				onClick={flipDirection}
			/>
			{props.options && props.options.map(o =>
				<SortButton
					key={o}
					by={o}
					selected={props.by === o}
					onClick={() => onSortByClick(o)}
				/>
			)}
			
		</ToggleButtonGroup>
	);
}
