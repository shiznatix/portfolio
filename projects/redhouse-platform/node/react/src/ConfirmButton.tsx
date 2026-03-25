import DeleteIcon from '@mui/icons-material/Delete';
import Button, { ButtonProps } from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import { cloneElement,useEffect, useState } from 'react';

import FlexChip from './FlexChip';

interface ConfirmButtonProps {
	onConfirm: () => void;
	disableClick?: boolean;
	timeout?: number;
	hidden?: boolean;
	disabled?: boolean;
	label?: string | React.ReactElement;
	icon?: React.ReactElement;
	size?: ButtonProps['size'];
	variant?: ButtonProps['variant'];
	defaultColor?: ButtonProps['color'];
	confirmColor?: ButtonProps['color'];
	component?: 'button' | 'chip';
	sx?: SxProps<Theme>;
}

interface IconProps {
	rotate: boolean;
	rotateMs: number;
	icon?: React.ReactElement;
}

const Icon: React.FC<IconProps> = ({ rotate, rotateMs, icon }) => {
	const rotateSec = (rotateMs / 1000).toFixed(1);
	const sx = {
		transform: `rotate(${rotate ? '360' : '0'}deg)`,
		transition: `${rotateSec}s ease`,
	};

	if (icon) {
		return cloneElement(icon, {
			// @ts-expect-error
			sx,
		});
	}

	return <DeleteIcon sx={sx} />;
};

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({
	onConfirm,
	disableClick,
	hidden,
	disabled,
	label,
	icon,
	size,
	timeout = 1500,
	variant = 'outlined',
	defaultColor = 'error',
	confirmColor = 'error',
	component,
	sx,
}) => {
	const [confirmWarn, setConfirmWarn] = useState(false);
	const hasLabel = !!label;
	const color = confirmWarn ? confirmColor : defaultColor;
	const mergedSx = { borderWidth: 1, borderStyle: 'solid', ...sx };
	const iconRotateMs = confirmWarn ? timeout / 2 : timeout / 4;
	const iconEl = <Icon rotate={confirmWarn} rotateMs={iconRotateMs} icon={icon} />;

	const handleClick = (e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation();
		if (disableClick) return;
		if (confirmWarn) {
			onConfirm();
			setConfirmWarn(false);
		} else {
			setConfirmWarn(true);
		}
	};

	useEffect(() => {
		if (confirmWarn) {
			const t = setTimeout(() => setConfirmWarn(false), timeout);
			return () => clearTimeout(t);
		}
	}, [confirmWarn]);

	if (component === 'chip') {
		return (
			<FlexChip
				size={size === 'large' ? 'medium' : size}
				variant={variant === 'contained' ? 'filled' : 'outlined'}
				color={(color === 'inherit' ? 'default' : color) as 'default' | 'primary' | 'error' | 'success' | 'warning'}
				disabled={disabled === true}
				onClick={handleClick}
				startDecorator={hasLabel ? iconEl : undefined}
				sx={mergedSx}
				withBorder
			>
				{hasLabel ? label : iconEl}
			</FlexChip>
		);
	}

	if (hasLabel) {
		return (
			<Button
				size={size}
				color={color}
				variant={confirmWarn ? 'contained' : variant}
				hidden={hidden === true}
				disabled={disabled === true}
				onClick={handleClick}
				startIcon={iconEl}
				sx={mergedSx}
			>
				{label}
			</Button>
		);
	}

	return (
		<IconButton
			size={size}
			color={color}
			hidden={hidden === true}
			disabled={disabled === true}
			onClick={handleClick}
			sx={mergedSx}
		>
			{iconEl}
		</IconButton>
	);
};

export default ConfirmButton;

