import React, { useEffect, useState } from 'react';
import { Input } from '@mui/joy';
import Dialog from '../../../Dialog';
import { RandomPreset } from '../../../../types';

interface IProps {
	open: boolean;
	preset: RandomPreset;
	onClose: () => void;
	onSave: (name: string) => void;
}

export default function SavePresetDialog(props: IProps): React.ReactElement {
	const [name, setName] = useState<string>('');
	const handleSave = () => {
		if (name) {
			props.onSave(name);
			props.onClose();
		}
	};

	useEffect(() => {
		if (props.open) {
			setName(props.preset.name.trim());
		}
	}, [props.open])

	return (
		<Dialog.Dialog
			open={props.open}
			title="Save Preset"
			primaryLabel="Save"
			primaryButtonDisabled={name === ''}
			onPrimaryAction={handleSave}
			onCancel={props.onClose}
		>
			<Input type="text" value={name} onChange={event => setName(event.target.value.trim())} />
		</Dialog.Dialog>
	);
}
