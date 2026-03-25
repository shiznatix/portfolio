import React, { useEffect, useState } from 'react';
import { Button, IconButton } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FlexChip from './FlexChip';
import { MuiColor, MuiSize, MuiVariant } from '../types';

type IProps = {
	onConfirm: () => void;
	disableClick?: boolean;
	timeout?: number;
	hidden?: boolean;
	disabled?: boolean;
	label?: string | number | React.ReactElement;
	icon?: React.ReactElement;
	size?: MuiSize;
	variant?: MuiVariant;
	defaultColor?: MuiColor;
	confirmColor?: MuiColor;
	component?: 'button' | 'chip';
	sx?: SxProps;
};

type IPropsIcon = {
	rotate: boolean;
	rotateMs: number;
	icon?: React.ReactElement;
};

function Icon(props: IPropsIcon) {
	const rotateSec = (props.rotateMs / 1000).toFixed(1);
	const sx = {
		transform: `rotate(${props.rotate ? '360' : '0'}deg)`,
		transition: `${rotateSec}s ease`,
	};

	if (props.icon) {
		return React.cloneElement(props.icon, { sx });
	}

	return <DeleteForeverIcon sx={sx} />;
}

export default function ConfirmButton(props: IProps): React.ReactElement {
	const [confirmWarn, setConfirmWarn] = useState(false);
	const onConfirmClick = (e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation();

		if (confirmWarn) {
			props.onConfirm();
			setConfirmWarn(false);
		} else {
			setConfirmWarn(true);
		}
	};
	const hasLabel = typeof props.label !== 'undefined';
	const timeoutMs = props.timeout || 1500;
	const color = confirmWarn ? (props.confirmColor || 'danger') : (props.defaultColor || 'warning');
	const variant = props.variant ? props.variant : 'outlined';
	const onClick = props.disableClick === true ? undefined : onConfirmClick;
	const icon = <Icon
		rotate={confirmWarn}
		rotateMs={timeoutMs}
		icon={props.icon}
	/>;
	const sx = {
		borderWidth: 1,
		borderStyle: 'solid',
		...props.sx,
	};

	useEffect(() => {
		if (confirmWarn) {
			const timeout = setTimeout(() => setConfirmWarn(false), timeoutMs);
			
			return () => clearTimeout(timeout);
		}
	}, [confirmWarn]);

	if (props.component === 'chip') {
		if (hasLabel) {
			return (
				<FlexChip
					size={props.size}
					variant={variant}
					color={color}
					disabled={props.disabled === true}
					onClick={onClick}
					startDecorator={icon}
					withBorder={true}
					sx={sx}
				>
					{props.label}
				</FlexChip>
			);
		}

		return (
			<FlexChip
				size={props.size}
				variant={variant}
				color={color}
				disabled={props.disabled === true}
				onClick={onClick}
				withBorder={true}
				sx={sx}
			>
				{icon}
			</FlexChip>
		);
	}

	if (hasLabel) {
		return (
			<Button
				size={props.size}
				color={color}
				variant={confirmWarn ? 'solid' : props.variant}
				hidden={props.hidden === true}
				disabled={props.disabled === true}
				onClick={onClick}
				startDecorator={icon}
				sx={sx}
			>
				{props.label}
			</Button>
		);
	}

	return (
		<IconButton
			size={props.size}
			color={color}
			variant={confirmWarn ? 'solid' : props.variant}
			hidden={props.hidden === true}
			disabled={props.disabled === true}
			onClick={onClick}
			sx={sx}
		>
			{icon}
		</IconButton>
	);
}
