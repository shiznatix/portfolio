import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, Stack } from '@mui/joy';
import Dialog from '../../../Dialog';
import DividerLine from '../../../DividerLine';
import { ApiContext } from '../../../../context';
import { arrayUnique, removeOrAppend } from '../../../../functions';
import * as api from '../../../../api';

type IProps = {
	open: boolean;
	path: string;
	labels: string[];
	onSelect: (labels: string[]) => void;
	onClose: () => void;
};

// TODO tons of code duplication here with `FileLablesDialog`. See if we can merge the 2 somehow!?!?!
function setLabels(labels: string[]) {
	const newLabels = arrayUnique(structuredClone(labels)).map(l => l.trim()).filter(l => l);
	newLabels.sort();

	return newLabels;
}

export default function BrowseLabelsDialog(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [allLabels, setAllLabels] = useState<string[]>([]);
	const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
	const [filteredLabels, setFilteredLabels] = useState<string[]>([]);
	const handleLabelClick = (label: string) => {
		setSelectedLabels(removeOrAppend(selectedLabels, label));
	};
	const onSet = () => {
		props.onSelect(selectedLabels);
		props.onClose();
	};

	useEffect(() => {
		setFilteredLabels(
			setLabels(allLabels.filter(l => !selectedLabels.includes(l))),
		);
	}, [allLabels, selectedLabels]);
	useEffect(() => {
		if (props.open) {
			setSelectedLabels(props.labels);
			apiCall(async () => {
				const res = await api.labels(props.path);
				const labels = res.map(l => l.name);

				setAllLabels(labels);
			});
		} else {
			setSelectedLabels([]);
			setAllLabels([]);
		}
	}, [props.open, props.labels]);

	return (
		<Dialog.Dialog
			open={props.open}
			title="Browse Labels"
			primaryLabel="Set"
			onPrimaryAction={onSet}
			cancelLabel="Cancel"
			onCancel={props.onClose}
		>
			<Box>
				<DividerLine label="Selected" />
				<Stack spacing={1} direction="row" flexWrap="wrap" useFlexGap>
					{selectedLabels.map(l =>
						<Button
							key={l}
							color="primary"
							variant="outlined"
							onClick={() => handleLabelClick(l)}
						>
							{l}
						</Button>
					)}
				</Stack>
				
				<DividerLine label="Available" />
				<Stack spacing={1} direction="row" flexWrap="wrap" useFlexGap>
					{filteredLabels.map(l =>
						<Button
							key={l}
							color="neutral"
							variant="outlined"
							onClick={() => handleLabelClick(l)}
						>
							{l}
						</Button>
					)}
				</Stack>
			</Box>
		</Dialog.Dialog>
	);
}
