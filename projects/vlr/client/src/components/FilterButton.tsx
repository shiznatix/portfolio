import React from 'react';
import { Badge, IconButton } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import ClearIcon from '@mui/icons-material/Clear';
import { FilterGroupValue } from '../types';

type IProps = {
	value: FilterGroupValue;
	badgeInset?: string;
	size?: 'sm' | 'md' | 'lg';
	onChange: (val: FilterGroupValue) => void;
	children: React.ReactNode;
};

export default function FilterButton(props: IProps): React.ReactElement {
	const buttonColor = props.value === 'both' ? 'primary' : props.value === 'yes' ? 'success' : 'warning';
	const yesHidden = props.value !== 'both' && props.value === 'no';
	const noHidden = props.value !== 'both' && props.value === 'yes';
	const size = props.size || 'sm';
	const slotProps = {
		badge: {
			sx: {
				backgroundColor: 'transparent',
				boxShadow: 'none',
			},
		},
	};
	const onClick = () => {
		const val = props.value === 'both' ? 'yes'
			: props.value === 'yes' ? 'no'
			: 'both';

		props.onChange(val);
	};

	return (
		<IconButton
			size={size}
			variant="soft"
			color={buttonColor}
			onClick={onClick}
		>
			<Badge
				invisible={yesHidden}
				badgeInset={props.badgeInset}
				badgeContent={<DoneIcon />}
				variant="plain"
				color="success"
				anchorOrigin={{
					vertical: 'top',
					horizontal: 'right',
				}}
				slotProps={slotProps}
			>
				<Badge
					invisible={noHidden}
					badgeInset={props.badgeInset}
					badgeContent={<ClearIcon />}
					variant="plain"
					color="danger"
					anchorOrigin={{
						vertical: 'top',
						horizontal: 'left',
					}}
					slotProps={slotProps}
				>
					{props.children}
				</Badge>
			</Badge>
		</IconButton>
	);
}
