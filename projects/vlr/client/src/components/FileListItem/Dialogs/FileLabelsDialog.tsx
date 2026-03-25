import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, IconButton, Input, Stack, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import Dialog from '../../Dialog';
import DividerLine from '../../DividerLine';
import { ApiContext } from '../../../context';
import Loadable from '../../Loadable';
import { arrayUnique, arraysEqual, removeByValue, parseFileName } from '../../../functions';
import * as api from '../../../api';

type IProps = {
	open: boolean;
	fileName: string;
	filePath: string;
	labels: string[];
	onClose: () => void;
	onUpdate?: (labels: string[]) => void;
};

function setLabels(labels: string[]) {
	const newLabels = arrayUnique(structuredClone(labels)).map(l => l.trim()).filter(l => l);
	newLabels.sort();

	return newLabels;
}

export default function FileLabelsDialog(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [allLabels, setAllLabels] = useState<string[] | null>(null);
	const [fileLabels, setFileLabels] = useState<string[]>([]);
	const [filteredLabels, setFilteredLabels] = useState<string[]>([]);
	const [newLabel, setNewLabel] = useState('');
	const handleSave = () => {
		apiCall(async () => {
			await api.setXAttrValue(props.filePath, 'labels', fileLabels.join(':'));

			if (props.onUpdate) {
				props.onUpdate(fileLabels);
			}

			props.onClose();
		});
	};
	const handleLabelAdd = (label: string) => {
		label = label.trim();

		if (!label) {
			return;
		}

		if (label === newLabel) {
			setNewLabel('');
		}

		setFileLabels(setLabels([
			...fileLabels,
			label,
		]));
	};
	const handleLabelRemove = (label: string) => setFileLabels(
		setLabels(removeByValue(fileLabels, label)),
	);

	useEffect(() => {
		setFilteredLabels(
			setLabels((allLabels || []).filter(l => !fileLabels.includes(l))),
		);
	}, [allLabels, fileLabels]);
	useEffect(() => {
		if (props.open) {
			setFileLabels(props.labels);
			apiCall(async () => {
				const res = await api.labels();
				const labels = res.map(l => l.name);

				setAllLabels(labels);
			});
		} else {
			setAllLabels(null);
			setFileLabels([]);
		}
	}, [props.open]);

	return (
		<Dialog.Dialog
			open={props.open}
			title="File Labels"
			primaryButtonDisabled={arraysEqual(fileLabels, props.labels)}
			onPrimaryAction={handleSave}
			cancelLabel="Cancel"
			onCancel={props.onClose}
		>
			<Typography
				level="body-lg"
				paddingBottom={2}
			>
				{parseFileName(props.fileName).name}
			</Typography>
			
			<Box>
				<Stack direction="row">
					<Input
						type="text"
						placeholder="New label..."
						value={newLabel}
						onChange={e => setNewLabel(e.target.value)}
					/>
					<IconButton
						disabled={!newLabel.trim()}
						color="success"
						onClick={() => handleLabelAdd(newLabel)}
					>
						<AddIcon />
					</IconButton>
				</Stack>

				<Loadable loading={allLabels === null}>
					<DividerLine label="Assigned" />
					<Stack spacing={1} direction="row" flexWrap="wrap" useFlexGap>
						{fileLabels.map(l =>
							<Button
								key={l}
								color="primary"
								variant="outlined"
								onClick={() => handleLabelRemove(l)}
							>
								{l}
							</Button>
						)}
					</Stack>
					
					<DividerLine label="Unassigned" />
					<Stack spacing={1} direction="row" flexWrap="wrap" useFlexGap>
						{filteredLabels.map(l =>
							<Button
								key={l}
								color="neutral"
								variant="outlined"
								onClick={() => handleLabelAdd(l)}
							>
								{l}
							</Button>
						)}
					</Stack>
				</Loadable>
			</Box>
		</Dialog.Dialog>
	);
}
