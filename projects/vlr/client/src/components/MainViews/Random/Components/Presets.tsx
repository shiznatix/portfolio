import React from 'react';
import { Box, Stack, useTheme } from '@mui/joy';
import { DndContext, DragEndEvent, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSwappingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import Preset from './Preset';
import { RandomPreset } from '../../../../types';

type IProps = {
	customPresets: RandomPreset[];
	selectedPresetId: string;
	unsavedPresetIds: string[];
	onSelect: (preset: RandomPreset) => void;
	onReorder: (fromIndex: number, toIndex: number) => void;
};

export default function Presets(props: IProps): React.ReactElement {
	const { vars: { palette } } = useTheme();
	const sensors = useSensors(
		useSensor(TouchSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(MouseSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
	);
	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		if (active.id && over?.id && active.id !== over.id) {
			const activeIndex = props.customPresets.findIndex(p => p.id === active.id);
			const overIndex = props.customPresets.findIndex(p => p.id === over.id);

			props.onReorder(activeIndex, overIndex);
		}
	};

	return (
		<Box sx={{
			backgroundColor: palette.background.level3,
			borderRadius: 5,
			paddingLeft: 0.5,
			paddingRight: 0.5,
			paddingTop: 1,
			paddingBottom: 1,
		}}>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				modifiers={[restrictToParentElement]}
				onDragEnd={handleDragEnd}
			>
				<SortableContext
					items={props.customPresets.map(p => p.id)}
					strategy={rectSwappingStrategy}
				>
					<Stack
						direction="row"
						flexWrap="wrap"
					>
						{props.customPresets.map(preset =>
							<Preset
								key={preset.name}
								preset={preset}
								selected={preset.id === props.selectedPresetId}
								unsaved={props.unsavedPresetIds.includes(preset.id)}
								onClick={() => props.onSelect(preset)}
							/>
						)}
					</Stack>
				</SortableContext>
			</DndContext>
		</Box>
	);
}
