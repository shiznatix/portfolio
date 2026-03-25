import React from 'react';
import { Badge, Box, Button, Divider, Stack, useTheme } from '@mui/joy';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RandomPreset } from '../../../../types';

type IProps = {
	preset: RandomPreset;
	selected: boolean;
	unsaved: boolean;
	onClick: () => void;
};

export default function Preset(props: IProps): React.ReactElement {
	const { vars: { palette } } = useTheme();
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
		id: props.preset.id,
	});
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<Box ref={setNodeRef} style={style} sx={{ padding: 0.2 }}>
			<Badge invisible={!props.unsaved}>
				<Button
					size="sm"
					color="primary"
					variant={props.selected ? 'solid' : 'outlined'}
					onClick={props.onClick}
					startDecorator={
						<Stack direction="row">
							<OpenWithIcon
								{...listeners}
								{...attributes}
							/>
							<Divider
								orientation="vertical"
								sx={{
									marginLeft: 0.5,
									backgroundColor: props.selected ? palette.common.white : palette.primary.plainColor,
								}}
							/>
						</Stack>
					}
					sx={{
						backgroundColor: props.selected ? palette.primary.solidBg : palette.primary.outlinedBorder,
					}}
				>
					{props.preset.name}
				</Button>
			</Badge>
		</Box>
	);
}
