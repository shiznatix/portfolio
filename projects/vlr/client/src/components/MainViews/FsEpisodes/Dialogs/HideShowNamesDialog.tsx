import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Box, Button, ButtonGroup, Divider, IconButton, Input, List, ListDivider, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Stack } from '@mui/joy';
import { IconAllChecked, IconAllUnchecked, IconCancel, IconCheckBoxChecked, IconCheckBoxUnChecked, IconEditName, IconNew, IconRestore, IconSave } from '../../../Icons';
import DividerLine from '../../../DividerLine';
import ConfirmButton from '../../../ConfirmButton';
import Dialog from '../../../Dialog';
import { removeOrAppend } from '../../../../functions';
import { EpisodesHideShowProfile, EpisodesMutators, MuiVariant } from '../../../../types';
import { getFsEpisodesHiddenShowsProfiles, saveFsEpisodesHiddenShowsProfiles } from '../../../../local-storage';

type Profile = Omit<EpisodesHideShowProfile, 'name'> & {
	name: string | null;
	unsaved: boolean;
	selected: boolean;
	editingName: boolean;
};

type ShowNamesMenuItem = {
	showName: string;
	variant: MuiVariant;
	selected: boolean;
	icon: React.ReactElement;
};

type IProps = {
	open: boolean;
	allShowNames: string[];
	mutators: EpisodesMutators;
	onCancel: () => void;
	onConfirm: (name: string | null, hideShowNames: string[]) => void;
};

export default function HideShowNamesDialog(props: IProps): React.ReactElement {
	const [hideUnselected, setHideUnselected] = useState(false);
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [editNameValue, setEditNameValue] = useState('');
	const saveableProfiles = useMemo(() => profiles.filter(p => p.name !== null), [profiles]);
	const profile = useMemo(() => profiles.find(p => p.selected), [profiles]);
	
	const resetProfiles = (resetSelected = false) => {
		setProfiles([
			{
				name: null,
				showNames: [],
				unsaved: false,
				selected: resetSelected ? true : false,
				editingName: false,
			},
			...getFsEpisodesHiddenShowsProfiles().map(p => ({
				...p,
				unsaved: false,
				selected: resetSelected ? false : p.name === profile?.name,
				editingName: false,
			})),
		]);
	};
	const onAllShowNamesClick = () => {
		setProfiles(p => p.map(p => ({
			...p,
			showNames: p.selected ? (allShowNamesSelected ? props.allShowNames : []) : p.showNames,
			unsaved: p.selected && p.name ? true : p.unsaved,
		})));
	};
	const onNewClick = () => {
		setProfiles([
			...profiles.map(p => ({
				...p,
				selected: false,
			})),
			{
				name: '*New*',
				showNames: [],
				unsaved: true,
				selected: true,
				editingName: false,
			},
		]);
	};
	const onProfileDeleteConfirm = () => {
		setProfiles(p => p.filter(p => !p.selected));
		saveFsEpisodesHiddenShowsProfiles(saveableProfiles.filter(p => !p.selected).map(p => ({
			name: p.name as string,
			showNames: p.showNames,
		})));
	};
	const onSaveClick = () => {
		// NB! This saves all profiles, maybe we only want to save currently selected?
		saveFsEpisodesHiddenShowsProfiles(saveableProfiles.map(p => ({
			name: p.name as string,
			showNames: p.showNames,
		})));
		resetProfiles();
	};
	const onProfileClick = (index: number) => {
		setProfiles(p => p.map((p, i) => ({
			...p,
			selected: i === index,
		})));
	};
	const onEditNameClick = (index: number) => {
		setEditNameValue(profiles[index].name || '');
		setProfiles(p => p.map((p, i) => ({
			...p,
			editingName: i === index,
		})));
	};
	const onEditNameCancel = () => {
		setProfiles(p => p.map(p => ({
			...p,
			editingName: false,
		})));
	};
	const onEditNameSave = (index: number) => {
		setProfiles(p => p.map((p, i) => ({
			...p,
			name: i === index ? editNameValue : p.name,
			unsaved: i === index || p.unsaved,
			editingName: false,
		})));
	};
	const onShowNameClick = (showName: string) => {
		setProfiles(p => p.map(p => ({
			...p,
			showNames: p.selected ? removeOrAppend(p.showNames, showName) : p.showNames,
			unsaved: p.selected && p.name ? true : p.unsaved,
		})));
	};
	const onConfirm = () => {
		const profile = profiles.find(p => p.selected);
		props.onConfirm(profile?.name || null, profile?.showNames || []);
	};

	const allShowNames = useMemo(() => {
		return props.allShowNames.map(showName => {
			const hidden = profile?.showNames.includes(showName);

			return {
				showName,
				variant: (hidden ? 'plain' : 'soft') as MuiVariant,
				selected: !hidden,
				icon: hidden ? <IconCheckBoxUnChecked color="primary" /> : <IconCheckBoxChecked color="success" />,
			};
		}).filter(n => n) as ShowNamesMenuItem[];
	}, [props.allShowNames, profile?.showNames]);
	const visibleShowNames = useMemo(() => {
		if (!hideUnselected) {
			return allShowNames;
		}

		return allShowNames.filter(n => n.selected);
	}, [allShowNames, hideUnselected]);
	const allShowNamesSelected = allShowNames.every(n => n.selected);

	useEffect(() => {
		resetProfiles(true);
	}, []);

	return (
		<Dialog.Dialog
			open={props.open}
			title="Show Visibilities"
			onCancel={props.onCancel}
			primaryLabel="Set"
			onPrimaryAction={onConfirm}
			primaryButtonColor={profile?.unsaved ? 'warning' : 'primary'}
			disableMainContentComponent={true}
		>
			<Box sx={{
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				overflowY: 'auto',
			}}>
				<Stack
					direction="row"
					spacing={1}
					sx={{
						width: '100%',
						marginTop: 1,
					}}
				>
					<IconButton
						size="sm"
						variant="outlined"
						color="neutral"
						onClick={onAllShowNamesClick}
					>
						{allShowNamesSelected ? <IconCheckBoxChecked /> : <IconCheckBoxUnChecked />}
					</IconButton>
					
					<Button
						size="sm"
						variant="outlined"
						startDecorator={hideUnselected ? <IconAllUnchecked /> : <IconAllChecked />}
						onClick={() => setHideUnselected(!hideUnselected)}
					>
						{hideUnselected ? 'Show' : 'Hide'}
					</Button>

					<Divider orientation="vertical" />

					<ConfirmButton
						size="sm"
						timeout={700}
						disabled={(profile?.name ?? null) === null}
						defaultColor="danger"
						onConfirm={onProfileDeleteConfirm}
					/>

					<Divider orientation="vertical" />

					<Stack
						flexGrow={1}
						direction="row"
						spacing={0.3}
						justifyContent="end"
					>
						<ConfirmButton
							icon={<IconRestore />}
							size="sm"
							variant="outlined"
							defaultColor="warning"
							onConfirm={resetProfiles}
						/>
						<IconButton
							color="primary"
							size="sm"
							variant="outlined"
							onClick={onNewClick}
						>
							<IconNew />
						</IconButton>
						<IconButton
							color="success"
							size="sm"
							disabled={!profiles.some(p => p.unsaved)}
							variant={profiles.some(p => p.unsaved) ? 'solid' : 'outlined'}
							onClick={onSaveClick}
						>
							<IconSave />
						</IconButton>
					</Stack>
				</Stack>

				<DividerLine label="Profiles" />

				<Stack direction="row" spacing={1}>
					{profiles.map((p, i) =>
						<Badge
							key={`${p.name || '__default__'}-${i}`}
							invisible={!p.unsaved}
						>
							{p.editingName &&
								<ButtonGroup size="sm">
									<IconButton
										variant="outlined"
										color="danger"
										onClick={onEditNameCancel}
									>
										<IconCancel />
									</IconButton>
									<Input
										size="sm"
										value={editNameValue}
										onChange={e => setEditNameValue(e.target.value)}
										sx={{
											maxWidth: 100,
										}}
									/>
									<IconButton
										variant="outlined"
										color="success"
										onClick={() => onEditNameSave(i)}
									>
										<IconSave />
									</IconButton>	
								</ButtonGroup>
							}
							{!p.editingName &&
								<ButtonGroup size="sm">
									{p.name !== null &&
										<IconButton
											variant="outlined"
											onClick={() => onEditNameClick(i)}
										>
											<IconEditName />
										</IconButton>
									}
									<Button
										color="primary"
										variant={p.selected ? 'solid': 'soft'}
										onClick={() => onProfileClick(i)}
										sx={{
											fontStyle: p.name === null ? 'italic' : 'normal',
										}}
									>
										{p.name === null ? 'Default' : p.name}
									</Button>
								</ButtonGroup>
							}
						</Badge>
					)}
				</Stack>

				<DividerLine label="Shows" />

				<List sx={{
					flexGrow: 1,
					overflowY: 'auto',
				}}>
					{visibleShowNames.map(n =>
						<Box key={n.showName}>
							<ListItem onClick={() => onShowNameClick(n.showName)}>
								<ListItemButton>
									<ListItemDecorator>{n.icon}</ListItemDecorator>
									<ListItemContent>{n.showName}</ListItemContent>
								</ListItemButton>
							</ListItem>
							<ListDivider />
						</Box>
					)}
				</List>
			</Box>
		</Dialog.Dialog>
	)
}
