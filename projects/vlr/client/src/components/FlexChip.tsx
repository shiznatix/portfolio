import React from 'react';
import { Chip, ChipProps } from '@mui/joy';

type IProps = ChipProps & {
	withBorder?: boolean;
};

export default function FlexChip(props: IProps): React.ReactElement {
	const sx = props.withBorder ? {
		borderWidth: 1,
		borderStyle: 'solid',
	} : {};
	const { withBorder, ...chipProps } = props;

	return (
		<Chip
			{...chipProps}
			sx={sx}
			slotProps={{
				label: {
					sx: {
						display: 'flex',
					},
				},
			}}
		>
			{props.children}
		</Chip>
	);
}
