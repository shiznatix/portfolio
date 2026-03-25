import React from 'react';
import { LinearProgress, Typography } from '@mui/joy';
import { PlayProgress } from '../../../types';
import VlcStateIcon from './VlcStateIcon';

type IProps = PlayProgress;

type IPropsLabel = {
	textAlign: 'left' | 'center' | 'right';
	children: React.ReactNode;
	endDecorator?: React.ReactNode;
};

function Label(props: IPropsLabel) {
	return (
		<Typography
			level="body-xs"
			fontWeight="xl"
			textColor="common.white"
			endDecorator={props.endDecorator}
			justifyContent="center"
			sx={{ width: '33%', textAlign: props.textAlign, mixBlendMode: 'difference' }}
		>
			{props.children}
		</Typography>
	);
}

export default function ProgressBar(props: IProps): React.ReactElement {
	return (
		<LinearProgress
			determinate
			variant="outlined"
			size="sm"
			color="neutral"
			thickness={32}
			value={props.percent}
			sx={{
				'--LinearProgress-radius': '0px',
				'--LinearProgress-progressThickness': '24px',
				boxShadow: 'sm',
				borderColor: 'neutral.500',
				maxHeight: '20px',
			}}
		>
			<Label textAlign="left">
				{props.played}
			</Label>

			<Label textAlign="center" endDecorator={<VlcStateIcon state={props.state} />}>
				{props.percent}% - {props.remaining}
			</Label>

			<Label textAlign="right">
				{props.duration}
			</Label>
		</LinearProgress>
	);
}
