import IconArrowLeft from '@mui/icons-material/ArrowBack';
import IconArrowDown from '@mui/icons-material/ArrowDownward';
import IconArrowRight from '@mui/icons-material/ArrowForward';
import IconArrowUp from '@mui/icons-material/ArrowUpward';
import IconShutter from '@mui/icons-material/Camera';
import IconCenter from '@mui/icons-material/ControlCamera';
import IconStats from '@mui/icons-material/InfoOutlined';
import IconReset from '@mui/icons-material/Restore';
import IconRecordings from '@mui/icons-material/VideoLibrary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { SxProps, Theme } from '@mui/material/styles';
import React from 'react';

import { postCameraServo } from '../../api';
import {
	useBrightness,
	useCameraConfig,
	useCameraContext,
	usePaused,
	useStreamType,
} from '../../contexts/context';
import { getShortStreamType } from '../../functions';
import { CameraStreamType } from '../../types';

type ClickEvent = React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>;

interface SectionProps {
	title: string;
	titleEndDecorator?: React.ReactNode;
	children?: React.ReactNode;
	buttons?: {
		onClick: () => void;
		startDecorator?: React.ReactNode;
		label: string;
	}[];
}

const Section: React.FC<SectionProps> = (props) => {
	const items = props.children
		? React.Children.toArray(props.children).map((child, idx) => (
			<MenuItem key={idx}>{child}</MenuItem>
		))
		: props.buttons
			? props.buttons.map((item, idx) => (
				<SectionItemButton
					key={idx}
					label={item.label}
					startDecorator={item.startDecorator}
					onClick={item.onClick}
				/>
			))
			: null;

	return (
		<>
			<ListSubheader
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1,
					lineHeight: '32px',
					bgcolor: 'transparent',
				}}
			>
				{props.title}
				{props.titleEndDecorator}
			</ListSubheader>
			{items}
			<Divider />
		</>
	);
};

interface SectionItemButtonProps {
	label: string | React.ReactNode;
	startDecorator?: React.ReactNode;
	variant?: 'contained' | 'outlined' | 'text';
	onClick: () => void;
	sx?: SxProps<Theme>;
}

const SectionItemButton: React.FC<SectionItemButtonProps> = (props) => {
	return (
		<MenuItem
			onClick={props.onClick}
			sx={props.sx}
		>
			{props.startDecorator &&
				<ListItemIcon>
					{props.startDecorator}
				</ListItemIcon>
			}
			{props.label}
		</MenuItem>
	);
};

export type CameraMenuProps = {
	anchorEl: HTMLElement | null;
	onClose: () => void;
};

const CameraMenu: React.FC<CameraMenuProps> = ({ anchorEl, onClose }) => {
	const cameraConfig = useCameraConfig();
	const paused = usePaused();
	const streamType = useStreamType();
	const brightness = useBrightness();
	const { setUiState } = useCameraContext();

	const servoApiCall: {
		(event: ClickEvent, name: string, action: 'center' | 'max' | 'min'): Promise<void>;
		(event: ClickEvent, name: string, action: 'move', value: number): Promise<void>;
		(event: ClickEvent, name: string, action: 'step', direction: 'cw' | 'ccw'): Promise<void>;
	} = async (event: ClickEvent, name: string, action: 'center' | 'max' | 'min' | 'move' | 'step', valueOrDirection?: number | 'cw' | 'ccw') => {
		event.stopPropagation();

		if (cameraConfig.servosUrl) {
			try {
				const value = typeof valueOrDirection === 'number' ? valueOrDirection : undefined;
				const direction = typeof valueOrDirection === 'string' ? valueOrDirection : undefined;

				await postCameraServo(`${cameraConfig.servosUrl}/${name}`, {
					action,
					value,
					direction,
				});
			} catch (e) {
				console.error(e);
			}
		}
	};

	const onBrightnessChange = (event: ClickEvent, changeAmountOrReset: number | true) => {
		event.stopPropagation();
		const newBrightness = changeAmountOrReset === true
			? '100%'
			: `${(parseFloat(brightness) + changeAmountOrReset * 100).toFixed(0)}%`;
		setUiState(prev => ({ ...prev, brightness: newBrightness }));
	};

	const onStreamTypeChange = (newStreamType: CameraStreamType) => {
		setUiState(prev => ({ ...prev, streamType: newStreamType }));
	};

	const openStatsDialog = () => {
		setUiState(prev => ({ ...prev, statsDialogOpen: true }));
		onClose();
	};
	const openRecordingsDialog = () => {
		setUiState(prev => ({ ...prev, recordingsDialogOpen: true }));
		onClose();
	};
	const btnProps = {
		variant: 'outlined' as const,
		size: 'small' as const,
	};

	return (
		<Menu
			anchorEl={anchorEl}
			open={Boolean(anchorEl)}
			onClose={onClose}
			slotProps={{ paper: { sx: { minWidth: 220 } } }}
		>
			<Section
				title="API"
				buttons={[
					{ label: 'Stats', startDecorator: <IconStats />, onClick: openStatsDialog },
					{ label: 'Recordings', startDecorator: <IconRecordings />, onClick: openRecordingsDialog },
				]}
			/>

			{cameraConfig.streamTypes.length > 1 &&
				<Section title="Stream Type">
					<MenuItem sx={{ py: 0.5 }}>
						<ButtonGroup size="small" sx={{ width: '100%' }}>
							{cameraConfig.streamTypes.map(configStreamType =>
								<Button
									{...btnProps}
									key={configStreamType}
									variant={streamType === configStreamType ? 'contained' : 'outlined'}
									onClick={() => onStreamTypeChange(configStreamType)}
									sx={{ flex: 1 }}
								>
									{getShortStreamType(configStreamType)}
								</Button>
							)}
						</ButtonGroup>
					</MenuItem>
					<Divider />
				</Section>
			}

			{!paused &&
				<Section
					title="Brightness:"
					titleEndDecorator={<Chip size="small" variant="outlined" label={brightness} />}
				>
					<MenuItem sx={{ py: 0.5 }}>
						<Box sx={{ display: 'flex', width: '100%', gap: 0.5 }}>
							<IconButton {...btnProps} onClick={(e) => onBrightnessChange(e, 0.1)}>
								<IconArrowUp />
							</IconButton>
							<IconButton {...btnProps} onClick={(e) => onBrightnessChange(e, -0.1)}>
								<IconArrowDown />
							</IconButton>
							<IconButton {...btnProps} onClick={(e) => onBrightnessChange(e, true)}>
								<IconReset />
							</IconButton>
						</Box>
					</MenuItem>
				</Section>
			}

			{cameraConfig.canShutter &&
				<Section
					title="Shutter"
					titleEndDecorator={<IconShutter sx={{ opacity: 0.5 }} />}
				>
					<MenuItem sx={{ py: 0.5 }}>
						<ButtonGroup size="small" sx={{ width: '100%' }}>
							<Button {...btnProps} disabled={paused} onClick={(e) => servoApiCall(e, 'shutter', 'max')} sx={{ flex: 1 }}>Open</Button>
							<Button {...btnProps} disabled={paused} onClick={(e) => servoApiCall(e, 'shutter', 'min')} sx={{ flex: 1 }}>Close</Button>
						</ButtonGroup>
					</MenuItem>
				</Section>
			}

			{(cameraConfig.canTilt || cameraConfig.canPan) &&
				<Section title="Move">
					<MenuItem sx={{ py: 0.5 }}>
						<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', width: '100%' }}>
							<Box />
							<Box sx={{ textAlign: 'center' }}>
								<IconButton {...btnProps} disabled={paused || !cameraConfig.canTilt} onClick={(e) => servoApiCall(e, 'tilt', 'step', 'ccw')}><IconArrowUp /></IconButton>
							</Box>
							<Box />
							<Box sx={{ textAlign: 'right' }}>
								<IconButton {...btnProps} disabled={paused || !cameraConfig.canPan} onClick={(e) => servoApiCall(e, 'pan', 'step', 'cw')}><IconArrowLeft /></IconButton>
							</Box>
							<Box sx={{ textAlign: 'center' }}>
								<IconButton {...btnProps} disabled={paused} onClick={(e) => servoApiCall(e, 'all', 'center')}><IconCenter /></IconButton>
							</Box>
							<Box sx={{ textAlign: 'left' }}>
								<IconButton {...btnProps} disabled={paused || !cameraConfig.canPan} onClick={(e) => servoApiCall(e, 'pan', 'step', 'ccw')}><IconArrowRight /></IconButton>
							</Box>
							<Box />
							<Box sx={{ textAlign: 'center' }}>
								<IconButton {...btnProps} disabled={paused || !cameraConfig.canTilt} onClick={(e) => servoApiCall(e, 'tilt', 'step', 'cw')}><IconArrowDown /></IconButton>
							</Box>
							<Box />
						</Box>
					</MenuItem>
				</Section>
			}

		</Menu>
	);
};

export default CameraMenu;

