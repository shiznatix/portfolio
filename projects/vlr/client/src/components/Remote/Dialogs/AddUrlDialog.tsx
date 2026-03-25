import React, { useContext, useEffect, useState } from 'react';
import { Input } from '@mui/joy';
import Dialog from '../../Dialog';
import { ApiContext } from '../../../context';
import * as api from '../../../api';
import { SetPlaylistMethod } from '../../../types';

interface IProps {
	open: boolean;
	onClose: () => void;
}

export default function AddUrlDialog(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [url, setUrl] = useState('');
	const onAdd = (method: SetPlaylistMethod) => {
		apiCall(async () => {
			// TODO we should handle an array of URLs
			await api.setPlaylistStreamUrls([url], method);
			props.onClose();
		});
	};

	useEffect(() => {
		if (!props.open) {
			setUrl('');
		}
	}, [props.open]);

	return (
		<Dialog.Dialog
			open={props.open}
			title="Add Streaming URL"
			primaryLabel="Append"
			primaryButtonDisabled={!url}
			onPrimaryAction={() => onAdd('append')}
			secondaryLabel="Replace"
			secondaryButtonDisabled={!url}
			onSecondaryAction={() => onAdd('replace')}
			onCancel={props.onClose}
		>	
			<Input placeholder="URL" type="text" onChange={e => setUrl(e.target.value.trim())} value={url} />
		</Dialog.Dialog>
	);
}
