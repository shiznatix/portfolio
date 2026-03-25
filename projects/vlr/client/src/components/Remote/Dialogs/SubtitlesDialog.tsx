import React, { useContext, useEffect, useRef, useState } from 'react';
import { Box, Grid, IconButton, Input, Radio, RadioGroup, Stack, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Dialog from '../../Dialog';
import { SubtitleTrack } from '../../../types';
import * as api from '../../../api';
import { ApiContext } from '../../../context';

type IProps = {
	open: boolean;
	delay: number;
	tracks: SubtitleTrack[];
	onClose: () => void;
};

export default function SubtitlesDialog(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [delay, setDelay] = useState(0);
	const [delayRepeatMod, setDelayRepeatMod] = useState(0);
	const delayRef = useRef(delay);
	const [trackId, setTrackId] = useState(-1);
	const onSet = () => {
		apiCall(async () => {
			await api.setSubtitleTrack(trackId);
			await api.setSubtitleDelay(delay);
			props.onClose();
		});
	};

	delayRef.current = delay;

	useEffect(() => {
		if (delayRepeatMod) {
			const newDelay = delayRef.current + delayRepeatMod;
			setDelay(newDelay);
			const timer = setInterval(() => setDelay(delayRef.current + delayRepeatMod), 100);

			return () => clearInterval(timer);
		}
	}, [delayRepeatMod]);
	useEffect(() => {
		setDelay(props.delay);
	}, [props.delay]);
	useEffect(() => {
		if (!props.open) {
			setTrackId(-1);
		}
	}, [props.open]);

	return (
		<Dialog.Dialog
			open={props.open}
			title="Subtitles"
			primaryLabel="Set"
			primaryButtonDisabled={props.tracks.length === 0}
			onPrimaryAction={onSet}
			onCancel={props.onClose}
		>
			<>
				{props.tracks.length === 0 &&
					<Typography
						visibility={props.tracks.length === 0 ? 'visible' : 'hidden'}
						level="body-lg"
					>
						No subtitle tracks
					</Typography>
				}

				{props.tracks.length > 0 &&
					<Stack direction="column" margin={1}>
						<Typography level="h3" textAlign="center">
							Delay
						</Typography>
						<Grid container sx={{ width: '50%', margin: 'auto' }}>
							<Grid xs={3}>
								<IconButton
									onMouseDown={() => setDelayRepeatMod(-0.5)}
									onMouseUp={() => setDelayRepeatMod(0)}
								>
									<RemoveIcon />
								</IconButton>
							</Grid>
							<Grid xs={6}>
								<Input
									type="number"
									value={delay}
								/>
							</Grid>
							<Grid xs={3}>
								<IconButton
									onMouseDown={() => setDelayRepeatMod(0.5)}
									onMouseUp={() => setDelayRepeatMod(0)}
								>
									<AddIcon />
								</IconButton>
							</Grid>
						</Grid>

						<Typography level="h3" textAlign="center" marginTop={2}>
							Tracks
						</Typography>
						<Box sx={{ width: '50%', margin: 'auto' }}>
							<RadioGroup
								value={trackId}
								onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTrackId(parseInt(event.target.value, 10))}
							>
								{props.tracks.length > 0 &&
									<Radio
										value={-1}
										label="Disabled"
									/>
								}
								{props.tracks.map(t =>
									<Radio
										key={t.id}
										value={t.id}
										label={t.language || 'Unknown'}
									/>
								)}
							</RadioGroup>
						</Box>
					</Stack>
				}
			</>
		</Dialog.Dialog>
	);
}
