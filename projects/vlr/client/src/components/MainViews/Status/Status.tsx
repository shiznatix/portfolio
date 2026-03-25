import React, { useContext, useEffect, useState } from 'react';
import { Accordion, AccordionDetails, AccordionGroup, AccordionSummary, Box, Button, Grid, Typography, useColorScheme } from '@mui/joy';
import { ApiContext } from '../../../context';
import { VlrLogs } from '../../../types';
import * as api from '../../../api';
import { useTvStatusState, useViewState, useVlcStatusState } from '../../../state';
import DividerLine from '../../DividerLine';
import ConfirmButton from '../../ConfirmButton';
import { IconDatabase, IconSync, IconTv } from '../../Icons';

export default function Status(): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const viewKey = useViewState(state => state.viewKey);
	const vlcStatus = useVlcStatusState(state => state.status);
	const tvStatus = useTvStatusState(state => state.status);
	const { mode, setMode } = useColorScheme();
	const [logs, setLogs] = useState<VlrLogs>({});
	const open = viewKey === 'status';
	const onRestartServiceConfirm = () => apiCall(async () => {
		await api.systemCommand('stop');
	});
	const onRebootConfirm = () => apiCall(async () => {
		await api.systemCommand('reboot');
	});
	const onDbSyncConfirm = (db: string) => apiCall(async () => {
		await api.syncDatabase(db, 'sync');
	});

	useEffect(() => {
		if (open) {
			apiCall(async () => {
				const res = await api.logs();
				const logs: VlrLogs = {};

				for (const [name, lvls] of Object.entries(res)) {
					for (const [lvl, msgs] of Object.entries(lvls)) {
						if (Array.isArray(msgs) && msgs.length > 0) {
							if (!logs[name]) {
								logs[name] = {};
							}

							logs[name][lvl] = msgs;
						}
					}
				}

				setLogs(logs);
			});
		}
	}, [open]);

	// TODO this is ugly!
	//   * put icons and whatnot for VLC and TV statuses!
	//   * add counts to accordion labels
	//   * add `location.reload(true)` to refresh without cache!
	return (
		<Box
			hidden={!open}
			sx={{
				height: '100%',
				overflowY: 'auto',
			}}
		>
			<Grid container spacing={0.5}>
				<Grid container xs={4} spacing={0}>
					<Grid xs={12}>
						<DividerLine label="Theme" />
					</Grid>

					<Grid xs={6}>
						<Button
							onClick={() => setMode('light')}
							disabled={mode === 'light'}
							sx={{ width: '100%' }}
						>
							Light
						</Button>
					</Grid>
					<Grid xs={6}>
						<Button
							onClick={() => setMode('dark')}
							disabled={mode === 'dark'}
							sx={{ width: '100%' }}
						>
							Dark
						</Button>
					</Grid>
				</Grid>
				<Grid xs={4}>
					<DividerLine label="VLR Service" />
					<ConfirmButton
						label="Restart"
						icon={<IconSync />}
						onConfirm={() => onRestartServiceConfirm()}
						sx={{ width: '100%' }}
					/>
				</Grid>
				<Grid xs={4}>
					<DividerLine label="Host" />
					<ConfirmButton
						label="Reboot"
						defaultColor="danger"
						confirmColor="danger"
						onConfirm={() => onRebootConfirm()}
						sx={{ width: '100%', backgroundColor: 'darkred', color: 'mistyrose' }}
					/>
				</Grid>

				<Grid xs={12}>
					<DividerLine label={{
						text: 'Database Sync',
						icon: <IconDatabase />,
					}} />
				</Grid>
				<Grid xs={6}>
					<ConfirmButton
						label="IMDB"
						icon={<IconSync />}
						defaultColor="neutral"
						onConfirm={() => onDbSyncConfirm('imdb')}
						sx={{ width: '100%' }}
					/>
				</Grid>
				<Grid xs={6}>
					<ConfirmButton
						label="MissingEps"
						icon={<IconSync />}
						defaultColor="neutral"
						onConfirm={() => onDbSyncConfirm('missingeps')}
						sx={{ width: '100%' }}
					/>
				</Grid>
				<Grid xs={6}>
					<ConfirmButton
						label="FSLabels"
						icon={<IconSync />}
						defaultColor="neutral"
						onConfirm={() => onDbSyncConfirm('fslabels')}
						sx={{ width: '100%' }}
					/>
				</Grid>
				<Grid xs={6}>
					<ConfirmButton
						label="FSEps"
						icon={<IconSync />}
						defaultColor="neutral"
						onConfirm={() => onDbSyncConfirm('fseps')}
						sx={{ width: '100%' }}
					/>
				</Grid>

				<Grid xs={6}>
					<DividerLine label="VLC Player" />
					{vlcStatus &&
						<Typography level="body-xs">
							<Box>
								<Typography fontWeight="lg">State: </Typography>
								<Typography>{vlcStatus.state}</Typography>
							</Box>
							<Box>
								<Typography fontWeight="lg">Position: </Typography>
								<Typography>{vlcStatus.position}</Typography>
							</Box>
							<Box>
								<Typography fontWeight="lg">Fullscreen: </Typography>
								<Typography>{vlcStatus.fullscreen ? 'YES' : 'NO'}</Typography>
							</Box>
						</Typography>
					}
				</Grid>

				<Grid xs={6}>
					<DividerLine label={{
						text: 'TV',
						icon: <IconTv />,
					}} />
					<Box>
						{tvStatus &&
							<Typography level="body-xs">
								<Box>
									<Typography>
										<Typography fontWeight="lg">Connected: </Typography>
										{tvStatus.connected ? 'YES' : 'NO'}
									</Typography>
								</Box>
								<Box>
									<Typography fontWeight="lg">Power: </Typography>
									<Typography>{tvStatus.power || 'N/A'}</Typography>
								</Box>
							</Typography>
						}
					</Box>
				</Grid>
			</Grid>

			<DividerLine label="Logs" />
			<Box>
				<AccordionGroup>
					{Object.entries(logs).map(([name, lvls]) =>
						<Accordion key={name}>
							<AccordionSummary>
								<Typography level="body-md">{name}</Typography>
							</AccordionSummary>
							<AccordionDetails>
								<AccordionGroup>
									{Object.entries(lvls).map(([lvl, msgs]) =>
										<Accordion key={lvl}>
											<AccordionSummary>
												<Typography level="body-sm">{lvl}</Typography>
											</AccordionSummary>
											<AccordionDetails>
												{msgs.map((m, i) =>
													<Box key={i}>
														<Typography level="body-xs">{m}</Typography>
													</Box>
												)}
											</AccordionDetails>
										</Accordion>
									)}
								</AccordionGroup>
							</AccordionDetails>
						</Accordion>
					)}
				</AccordionGroup>
			</Box>
		</Box>
	);
}
