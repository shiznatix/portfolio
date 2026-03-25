import React from 'react';
import { Divider, Typography } from '@mui/joy';
import FlexChip from './FlexChip';

type IProps = {
	label?: string | {
		text: string;
		icon?: React.ReactElement;
	};
	labels?: string[];
	children?: React.ReactNode;
};

export default function DividerLine(props: IProps): React.ReactElement {
	const sx = { margin: 1 };

	if (!props.label && !props.labels && !props.children) {
		return <Divider sx={sx} />;
	}

	return (
		<Divider sx={sx}>
			{props.label &&
				<Typography
					fontWeight="lg"
					level="body-xs"
					startDecorator={typeof props.label !== 'string' ? props.label.icon : null}
				>
					{typeof props.label === 'string' ? props.label : props.label.text}
				</Typography>
			}
			{props.labels && props.labels.map(l => 
				<FlexChip key={l} variant="soft" color="neutral" size="sm">
					{l}
				</FlexChip>
			)}
			{props.children}
		</Divider>
	);
}
