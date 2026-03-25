import React, { useContext, useEffect, useState } from 'react';
import { FormControl, Radio, RadioGroup, Typography } from '@mui/joy';
import Dialog from '../../Dialog';
import { AudioTrack } from '../../../types';
import { ApiContext } from '../../../context';
import * as api from '../../../api';

interface IProps {
	open: boolean;
	tracks: AudioTrack[];
	onClose: () => void;
}

export default function AudioTracksDialog(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [trackId, setTrackId] = useState(-1);
	const onChange = (event: React.ChangeEvent<HTMLInputElement>) => setTrackId(parseInt(event.target.value, 10));
	const onSet = () => {
		apiCall(async () => {
			await api.setAudioTrack(trackId);
			props.onClose();
		});
	};

	useEffect(() => {
		if (!props.open) {
			setTrackId(-1);
		}
	}, [props.open]);

	return (
		<Dialog.Dialog
			open={props.open}
			title="Audio Track"
			primaryLabel="Select"
			primaryButtonDisabled={props.tracks.length === 0}
			onPrimaryAction={onSet}
			onCancel={props.onClose}
		>
			<Typography
				visibility={props.tracks.length === 0 ? 'visible' : 'hidden'}
				level="body-lg"
			>
				No audio tracks
			</Typography>
			
			<FormControl>
				<RadioGroup value={trackId} onChange={onChange}>
					{props.tracks.map(t =>
						<Radio
							key={t.id}
							variant="outlined"
							value={t.id}
							label={t.language || 'Unknown'}
						/>
					)}
				</RadioGroup>
			</FormControl>
		</Dialog.Dialog>
	);
}
