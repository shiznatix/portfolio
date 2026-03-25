import React from 'react';
import { Box, Button, ButtonGroup, IconButton, Typography, useTheme } from '@mui/joy';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RemoveIcon from '@mui/icons-material/Remove';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ConfirmButton from '../../../ConfirmButton';
import { WidthLevel } from '../../../../types';

type IProps = {
	widthLevel: WidthLevel;
	label: string;
	id: string;
	selected: boolean;
	shows: string[];
	onClick: () => void;
	onDelete: () => void;
	onShowClick: (show: string) => void;
};

export default function Slot(props: IProps): React.ReactElement {
	const { vars: { palette } } = useTheme();
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
		id: props.id,
	});
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};
	const handleChipClick = (show: string) => {
		if (props.selected) {
			props.onShowClick(show);
		}
	};
	const hideButtons = props.widthLevel === 'xs';
	const buttonSize = props.widthLevel === 'xs' ? 'sm' : props.widthLevel;

	return (
		<Box ref={setNodeRef} style={style} paddingTop={0.5}>
			<ButtonGroup
				buttonFlex={1}
				size={buttonSize}
			>
				<IconButton
					{...listeners}
					{...attributes}
					color="primary"
					hidden={hideButtons}
					sx={{
						touchAction: 'manipulation',
						border: 1,
					}}
				>
					<OpenWithIcon />
				</IconButton>
				<Button
					startDecorator={props.selected ? <RadioButtonCheckedIcon /> : <RadioButtonUncheckedIcon />}
					variant="outlined"
					color={props.selected ? 'success' : 'primary'}
					onClick={props.onClick}
					sx={{
						border: 1,
						backgroundColor: props.selected ? palette.success.softBg : 'transparent',
					}}
				>
					<Typography
						level={`body-${props.widthLevel}`}
						fontWeight={props.selected ? 50 : 1}
					>
						{props.label}
					</Typography>
				</Button>
				<ConfirmButton
					hidden={hideButtons}
					onConfirm={props.onDelete}
					sx={{
						border: 1,
					}}
				/>
			</ButtonGroup>
			
			{props.shows.map(show =>
				<ConfirmButton
					key={show}
					component="chip"
					variant={props.selected ? 'soft' : 'outlined'}
					defaultColor="neutral"
					disabled={!props.selected}
					icon={<RemoveIcon />}
					label={<Typography noWrap level="body-xs">{show}</Typography>}
					onConfirm={() => handleChipClick(show)}
					sx={{ width: '100%', margin: 0.5 }}
				/>
			)}
		</Box>
	);
}
