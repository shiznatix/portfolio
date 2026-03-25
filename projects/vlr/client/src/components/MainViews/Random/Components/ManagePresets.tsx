import React, { useState } from 'react';
import { Badge, Box, IconButton, Stack, Typography, useTheme } from '@mui/joy';
import CopyAllIcon from '@mui/icons-material/CopyAll';
import { IconMaximize, IconMinimize, IconNew, IconRestore, IconSave } from '../../../Icons';
import ConfirmButton from '../../../ConfirmButton';
import Presets from './Presets';
import { RandomPreset } from '../../../../types';

type IProps = {
	emptyPreset: RandomPreset;
	customPresets: RandomPreset[];
	selectedPresetId: string;
	unsavedPresetIds: string[];
	onSelect: (preset: RandomPreset) => void;
	onReorder: (fromIndex: number, toIndex: number) => void;
	onReset: () => void;
	onCopy: () => void;
	onDelete: () => void;
	onSaveClick: () => void;
};

export default function ManagePresets(props: IProps): React.ReactElement {
	const { vars: { palette } } = useTheme();
	const [isCollapsed, setIsCollapsed] = useState(false);
	const emptyPresetSelected = props.selectedPresetId === props.emptyPreset.id;
	const selectedPresetName = props.customPresets.find(p => p.id === props.selectedPresetId)?.name;

	return (
		<Stack
			spacing={0.5}
			margin={0.3}
			sx={{
				backgroundColor: palette.background.level2,
				borderRadius: 5,
				paddingLeft: 0.5,
				paddingRight: 0.5,
				paddingTop: 1,
				paddingBottom: 1,
			}}
		>
			<Stack
				direction="row"
				sx={{
					backgroundColor: palette.background.level1,
				}}
			>
				<ConfirmButton
					onConfirm={props.onDelete}
					defaultColor="danger"
					disabled={emptyPresetSelected}
				/>

				<Stack
					direction="row"
					spacing={1}
					flexGrow={1}
					sx={{
						justifyContent: 'center',
					}}
				>
					<ConfirmButton
						onConfirm={props.onReset}
						defaultColor="warning"
						icon={<IconRestore />}
					/>
					<IconButton
						color="neutral"
						variant="outlined"
						onClick={props.onCopy}
					>
						<CopyAllIcon />
					</IconButton>
					<IconButton
						color="success"
						variant="outlined"
						onClick={props.onSaveClick}
						disabled={emptyPresetSelected && !props.unsavedPresetIds.includes(props.selectedPresetId)}
					>
						<Badge
							invisible={!props.unsavedPresetIds.includes(props.selectedPresetId)}
							anchorOrigin={{
								vertical: 'top',
								horizontal: 'right',
							}}
						>
							<IconSave />
						</Badge>
					</IconButton>
					<IconButton
						color={'primary'}
						variant={emptyPresetSelected ? 'solid' : 'outlined'}
						onClick={() => props.onSelect(props.emptyPreset)}
					>
						<Badge invisible={!props.unsavedPresetIds.includes(props.emptyPreset.id)}>
							<IconNew />
						</Badge>
					</IconButton>
				</Stack>

				<IconButton
					color={isCollapsed ? 'success' : 'warning'}
					variant="outlined"
					onClick={() => setIsCollapsed(!isCollapsed)}
				>
					{isCollapsed ? <IconMaximize /> : <IconMinimize />}
				</IconButton>
			</Stack>

			{!isCollapsed && props.customPresets.length > 0 &&
				<Box sx={{ width: '100%' }}>
					<Presets
						customPresets={props.customPresets}
						selectedPresetId={props.selectedPresetId}
						unsavedPresetIds={props.unsavedPresetIds}
						onSelect={props.onSelect}
						onReorder={props.onReorder}
					/>
				</Box>
			}
			{isCollapsed &&
				<Typography level="body-md">
					Preset: {selectedPresetName || 'No Preset Selected'}
				</Typography>
			}
		</Stack>
	);
}
