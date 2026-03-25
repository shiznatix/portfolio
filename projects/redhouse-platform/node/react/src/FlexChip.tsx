import type { ChipProps } from '@mui/material/Chip';
import Chip from '@mui/material/Chip';

interface FlexChipProps extends Omit<ChipProps, 'label' | 'children'> {
	withBorder?: boolean;
	startDecorator?: React.ReactNode;
	children?: React.ReactNode;
}

export const FlexChip: React.FC<FlexChipProps> = ({ withBorder, children, sx, startDecorator, ...props }) => {
	const borderSx = withBorder ? { borderWidth: 1, borderStyle: 'solid' } : {};

	return (
		<Chip
			{...props}
			icon={startDecorator as React.ReactElement | undefined}
			label={<span style={{ display: 'flex', alignItems: 'center' }}>{children}</span>}
			sx={{
				...borderSx,
				...sx,
			}}
		/>
	);
};

export default FlexChip;
