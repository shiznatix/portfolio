import React, { useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Grid } from '@mui/joy';
import SelectShows from './SelectShows';
import Slots from './Slots';
import { ApiContext } from '../../../../context';
import { removeOrAppend } from '../../../../functions';
import { RandomPresetSlot, ShowCategory, WidthLevel } from '../../../../types';
import * as api from '../../../../api';
import { useViewState } from '../../../../state';

export const makeEmptySlot = (): RandomPresetSlot => ({
	id: uuidv4(),
	shows: [],
});

type IProps = {
	selectedPresetId: string;
	slots: RandomPresetSlot[];
	maxSliderValue: number;
	sliderValue: number;
	onUpdate: (slots: RandomPresetSlot[]) => void;
};

function widthLevel(widthXs: number): WidthLevel {
	if (widthXs < 5) {
		return 'xs';
	} else if (widthXs < 7) {
		return 'sm';
	} else if (widthXs < 9) {
		return 'md';
	}

	return 'lg';
}

function getXs(val: number, cutoffXs: number, maxSx: number) {
	return val + cutoffXs >= maxSx ? maxSx : (val <= cutoffXs ? 0 : val);
}

export default function ManageSlots(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const viewKey = useViewState(state => state.viewKey);
	const open = viewKey === 'random';
	const [slotIndex, setSlotIndex] = useState(0);
	const [showCategories, setShowCategories] = useState<ShowCategory[]>([]);
	const toggleShowSelected = (show: string) => {
		const copy = structuredClone(props.slots);
		copy[slotIndex].shows = removeOrAppend(props.slots[slotIndex].shows, show);

		props.onUpdate(copy);
	};
	const handleOnAdd = () => {
		const copy = structuredClone(props.slots);
		copy.push(makeEmptySlot());

		setSlotIndex(copy.length - 1);
		props.onUpdate(copy);
	};

	useEffect(() => {
		setSlotIndex(0);
	}, [props.selectedPresetId]);
	useEffect(() => {
		if (open) {
			apiCall(async () => {
				// TODO these are being alphabetized but should instead be in the same order as our config has them...
				//   Looks like its coming from the server in alphabetical order... stop this from happening?
				//   Only way is to make the `shows` return an Array instead of an Object
				setShowCategories(await api.shows());
			});
		}
	}, [open]);
	
	const maxSx = 12;
	const cutoffXs = (maxSx - props.maxSliderValue) / 2;
	const showsXs = getXs(props.sliderValue + ((maxSx - props.maxSliderValue) / 2), cutoffXs, maxSx);
	const showsDisplay = showsXs <= cutoffXs ? 'none' : 'block';
	const slotsXs = getXs(maxSx - showsXs, cutoffXs, maxSx);
	const slotsDisplay = slotsXs < cutoffXs ? 'none' : 'block';

	return (
		<Grid container sx={{ height: '100%' }}>
			<Grid xs={showsXs} sx={{ display: showsDisplay }}>
				<SelectShows
					widthLevel={widthLevel(showsXs)}
					selected={props.slots[slotIndex]?.shows || []}
					categories={showCategories}
					onClick={toggleShowSelected}
				/>
			</Grid>
			<Grid xs={slotsXs} sx={{ display: slotsDisplay }}>
				<Slots
					widthLevel={widthLevel(slotsXs)}
					slots={props.slots}
					slotIndex={slotIndex}
					onSlotClick={i => setSlotIndex(i)}
					onShowClick={toggleShowSelected}
					onUpdate={props.onUpdate}
					onAdd={handleOnAdd}
				/>
			</Grid>
		</Grid>
	);
}
