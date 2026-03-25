import React from 'react';
import { Stack } from '@mui/joy';
import { IconEpisode, IconMaximum, IconPlay, IconPlayedCount, IconPrevious } from '../../Icons';
import FlexChip from '../../FlexChip';
import { timestampToStr } from '../../../functions';
import { MuiColor } from '../../../types';

type IProps = {
	color?: MuiColor;
	episodesCount?: number;
	lastPlayedTime?: number;
	maxPlayedCount?: number;
};

type IPropsChip = {
	color?: MuiColor;
	value?: string | number;
	endDecorator?: React.ReactElement;
}

function Chip(props: IPropsChip): React.ReactElement {
	return (
		<FlexChip
			size="sm"
			color={props.color || 'primary'}
			hidden={!props.value}
			endDecorator={props.endDecorator}
		>
			{props.value}
		</FlexChip>
	);
}

export default function AccordionChips(props: IProps): React.ReactElement {
	return (
		<Stack spacing={0.5} direction="row">
			<Chip
				value={props.episodesCount}
				color={props.color}
				endDecorator={
				<>
					<IconEpisode />
				</>}
			/>
			<Chip
				value={timestampToStr(props.lastPlayedTime)}
				color={props.color}
				endDecorator={
					<>
						<IconPrevious />
						<IconPlay />
					</>
				}
			/>
			<Chip
				value={props.maxPlayedCount}
				color={props.color}
				endDecorator={
					<>
						<IconMaximum />
						<IconPlayedCount />
					</>
				}
			/>
		</Stack>
	);
}
