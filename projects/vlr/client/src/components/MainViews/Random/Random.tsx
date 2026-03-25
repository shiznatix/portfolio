import React, { useContext, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Box } from '@mui/joy';
import PlaylistButtons from '../../PlaylistButtons';
import SavePresetDialog from './Dialogs/SavePresetDialog';
import ManageSlots, { makeEmptySlot } from './Components/ManageSlots';
import EpisodesCount from './Components/EpisodesCount';
import ManagePresets from './Components/ManagePresets';
import { ApiContext } from '../../../context';
import { deleteRandomPreset, getLastUsedRandomPresetId, getRandomPresets, reorderRandomPresets, saveLastUsedRandomPresetId, saveRandomPreset } from '../../../local-storage';
import { arrayMove, removeByKeyValue, removeByValue, updateByValue } from '../../../functions';
import { RandomPreset, SetPlaylistMethod } from '../../../types';
import * as api from '../../../api';
import { useViewState } from '../../../state';
import SliderDividerLine from './Components/SliderDividerLine';

const EMPTY_PRESET_ID = uuidv4();
const makeEmptyPreset = (): RandomPreset => ({
	id: EMPTY_PRESET_ID,
	name: '',
	count: 5,
	slots: [makeEmptySlot()],
});

export default function Random(): React.ReactElement {
	const defaultPresets = useMemo(() => getRandomPresets(), []);
	const maxSliderValue = 6;
	const defaultSliderValue = 3;
	const apiCall = useContext(ApiContext);
	const viewKey = useViewState(state => state.viewKey);
	const [emptyPreset, setEmptyPreset] = useState<RandomPreset>(makeEmptyPreset());
	const [customPresets, setCustomPresets] = useState<RandomPreset[]>(defaultPresets);
	const [selectedPresetId, setSelectedPresetId] = useState(emptyPreset.id);
	const [unsavedPresetIds, setUnsavedPresetIds] = useState<string[]>([]);
	const [sliderValue, setSliderValue] = useState(defaultSliderValue);
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const selectedPreset = customPresets.find(p => p.id === selectedPresetId) || emptyPreset;
	const open = viewKey === 'random';

	const reloadPresets = () => {
		setEmptyPreset(makeEmptyPreset());
		setCustomPresets(getRandomPresets());
		setSelectedPresetId(getLastUsedRandomPresetId() || emptyPreset.id);
		setUnsavedPresetIds([]);
	};
	const handleSelectPreset = (preset: RandomPreset) => {
		setSelectedPresetId(preset.id);
		saveLastUsedRandomPresetId(preset.id);
	};
	const handleCopyPreset = () => {
		const newName = `${selectedPreset.name} Copy`.trim();
		const copy = structuredClone(selectedPreset);
		copy.id = uuidv4();
		copy.name = newName;

		const presets = [
			...customPresets,
			copy,
		];

		setCustomPresets(presets);
		setSelectedPresetId(copy.id);
		setUnsavedPresetIds([
			...unsavedPresetIds,
			copy.id,
		]);
	};
	const handleSavePreset = (name: string) => {
		const preset = {
			...structuredClone(selectedPreset),
			name,
		};
		const presets = structuredClone(customPresets);

		if (preset.id === EMPTY_PRESET_ID) {
			preset.id = uuidv4();
			setEmptyPreset(makeEmptyPreset());
			setSelectedPresetId(preset.id);
		}

		const newLen = saveRandomPreset({
			...preset,
			name,
		});

		if (newLen > presets.length) {
			presets.push(preset);
		} else {
			updateByValue(presets, { name }, p => p.id === preset.id, true);
		}

		setCustomPresets(presets);
		setUnsavedPresetIds(removeByValue([...unsavedPresetIds], selectedPreset.id));
	};
	const handleDeletePreset = () => {
		const unsavedIds = removeByValue([...unsavedPresetIds], selectedPreset.id);
		const presets = removeByKeyValue(structuredClone(customPresets), 'id', selectedPreset.id);
		deleteRandomPreset(selectedPreset);
		
		setCustomPresets(presets);
		setUnsavedPresetIds(unsavedIds);
		setSelectedPresetId(emptyPreset.id);
	};
	const handleUpdatePreset = (vals: Partial<RandomPreset>) => {
		if (selectedPreset.id === EMPTY_PRESET_ID) {
			setEmptyPreset({
				...structuredClone(emptyPreset),
				...vals,
			});
		} else {
			setCustomPresets(updateByValue(customPresets, vals, p => p.id === selectedPreset.id));
		}

		if (!unsavedPresetIds.includes(selectedPreset.id)) {
			setUnsavedPresetIds([
				...unsavedPresetIds,
				selectedPreset.id,
			]);
		}
	};
	const handleReorderPresets = (fromIndex: number, toIndex: number) => {
		// Don't save the actual values of `customPresets` right here, just the reorder!
		reorderRandomPresets(fromIndex, toIndex);
		setCustomPresets(arrayMove(customPresets, fromIndex, toIndex));
	};
	const onPlaylistAction = (method: SetPlaylistMethod) => {
		apiCall(setIsLoading, async () => {
			setIsLoading(true);
			await api.random(selectedPreset.count, selectedPreset.slots, method);
			setIsLoading(false);
		});
	};

	useEffect(() => {
		if (open) {
			const lastId = getLastUsedRandomPresetId();

			setSelectedPresetId(customPresets.find(p => p.id === lastId)?.id || emptyPreset.id);
		}
	}, [open]);

	return (
		<Box
			hidden={!open}
			sx={{
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<EpisodesCount
				minCount={1}
				maxCount={15}
				count={selectedPreset.count}
				onUpdate={count => handleUpdatePreset({ count })}
			/>

			<ManagePresets
				emptyPreset={emptyPreset}
				customPresets={customPresets}
				selectedPresetId={selectedPresetId}
				unsavedPresetIds={unsavedPresetIds}
				onSelect={handleSelectPreset}
				onReorder={handleReorderPresets}
				onReset={reloadPresets}
				onCopy={handleCopyPreset}
				onDelete={handleDeletePreset}
				onSaveClick={() => setSaveDialogOpen(true)}
			/>

			<SliderDividerLine
				maxSliderValue={maxSliderValue}
				defaultSliderValue={defaultSliderValue}
				onUpdate={setSliderValue}
			/>

			<Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
				<ManageSlots
					selectedPresetId={selectedPresetId}
					slots={selectedPreset.slots}
					maxSliderValue={maxSliderValue}
					sliderValue={sliderValue}
					onUpdate={slots => handleUpdatePreset({ slots })}
				/>
			</Box>

			<Box sx={{ height: '10%' }}>
				<PlaylistButtons
					loading={isLoading}
					disabled={selectedPreset.count < 1}
					onClick={onPlaylistAction}
				/>
			</Box>

			<SavePresetDialog
				open={saveDialogOpen}
				preset={selectedPreset}
				onClose={() => setSaveDialogOpen(false)}
				onSave={handleSavePreset}
			/>
		</Box>
	);
}
