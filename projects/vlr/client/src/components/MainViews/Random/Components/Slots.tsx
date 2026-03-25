import React from 'react';
import { DndContext, DragEndEvent, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSwappingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { Box, IconButton, Stack } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import Slot from './Slot';
import { arrayMove } from '../../../../functions';
import { RandomPresetSlot, WidthLevel } from '../../../../types';

type IProps = {
	widthLevel: WidthLevel;
	slots: RandomPresetSlot[];
	slotIndex: number;
	onSlotClick: (slotIndex: number) => void;
	onShowClick: (show: string) => void;
	onUpdate: (slots: RandomPresetSlot[]) => void;
	onAdd: () => void;
};

export default function Slots(props: IProps): React.ReactElement {
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
			const activeIndex = props.slots.findIndex(s => s.id === active.id);
			const overIndex = props.slots.findIndex(s => s.id === over.id);

			props.onUpdate(arrayMove(props.slots, activeIndex, overIndex));
		}
	};
	const handleDelete = (index: number) => {
		const copy = structuredClone(props.slots);

		if (copy.length === 1) {
			copy[0].shows = [];
		} else {
			copy.splice(index, 1);
		}

		props.onUpdate(copy);
	};

	return (
		<Box sx={{ width: '100%' }}>
			<IconButton
				onClick={props.onAdd}
				color="primary"
				variant="outlined"
				sx={{ width: '100%' }}
			>
				<AddIcon />
				{props.widthLevel === 'xs' ? '' : 'Add Slot'}
			</IconButton>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				modifiers={[restrictToParentElement]}
				onDragEnd={handleDragEnd}
			>
				<SortableContext
					items={props.slots.map(s => s.id)}
					strategy={rectSwappingStrategy}
				>
					<Stack direction="column">
						{props.slots.map((slot, i) =>
							<Slot
								key={slot.id}
								widthLevel={props.widthLevel}
								label={`${i+1}`}
								id={slot.id}
								selected={i === props.slotIndex}
								shows={slot.shows}
								onClick={() => props.onSlotClick(i)}
								onDelete={() => handleDelete(i)}
								onShowClick={props.onShowClick}
							/>
						)}
					</Stack>
				</SortableContext>
			</DndContext>
		</Box>
	);
}
