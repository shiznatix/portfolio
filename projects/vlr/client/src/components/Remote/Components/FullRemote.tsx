import React from 'react';
import { Badge, Box, Button, ColorPaletteProp, Grid, IconButton, Stack, Typography } from '@mui/joy';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import ProgressBar from './ProgressBar';
import { DialogKey } from '../Remote';
import { playProgress } from '../functions';
import buttons from '../buttons';
import { RemoteButtonConfig } from '../../../types';
import { useTvStatusState, useVlcStatusState } from '../../../state';
import { config } from '../../../config';

type IProps = {
	onDialogOpen: (key: DialogKey) => void;
	onContractClick: () => void;
};

type IPropsRemoteButton = {
	button: RemoteButtonConfig;
	onClick: () => void;
	disabled?: boolean;
	color?: string;
	badgeContent?: number | boolean | React.ReactElement;
};

function RemoteButton(props: IPropsRemoteButton) {
	return (
		<Button
			variant={props.color ? 'soft' : 'outlined'}
			onClick={props.onClick}
			color={props.color as ColorPaletteProp}
			disabled={props.disabled === true}
			size="sm"
			sx={{
				height: '100%',
				width: '100%',
			}}
		>
			<Stack
				direction="column"
				justifyContent="center"
				alignItems="center"
				spacing={0}
			>
				<Badge
					color="success"
					size="md"
					variant="solid"
					invisible={typeof props.badgeContent === 'undefined' || props.badgeContent === false}
					badgeContent={props.badgeContent}
				>
					<Box sx={{ transform: 'scale(1.5)' }}>
						{props.button.icon}
					</Box>
				</Badge>

				<Typography level="body-md">
					{props.button.label}
				</Typography>

				{props.button.subLabel &&
					<Typography
						level="body-xs"
						fontStyle="italic"
					>
						{props.button.subLabel}
					</Typography>
				}
			</Stack>
		</Button>
	);
}

export default function FullRemote(props: IProps): React.ReactElement {
	const vlcStatus = useVlcStatusState(state => state.status);
	const tvStatus = useTvStatusState(state => state.status);
	const tvDisabled = !config.cecTvAddress;
	const vlcDisabled = !(vlcStatus && vlcStatus?.state !== 'closed');
	const tvOn = tvStatus?.power === 'on';
	const progress = playProgress(vlcStatus);
	const btnConfs = [
		{ btn: buttons.back, clk: buttons.back.onClick, dis: vlcDisabled },
		{ btn: buttons.forward, clk: buttons.forward.onClick, dis: vlcDisabled },
		{ btn: buttons.status, clk: () => props.onDialogOpen('status') },

		{ btn: buttons.backLarge, clk: buttons.backLarge.onClick, dis: vlcDisabled },
		{ btn: buttons.forwardLarge, clk: buttons.forwardLarge.onClick, dis: vlcDisabled },
		{ btn: buttons.subtitles, clk: () => props.onDialogOpen('subtitles') },
		
		{ btn: buttons.previous, clk: buttons.previous.onClick, dis: vlcDisabled },
		{ btn: buttons.next, clk: buttons.next.onClick, dis: vlcDisabled },
		{ btn: buttons.fullscreen, clk: buttons.fullscreen.onClick, dis: vlcDisabled },

		{ btn: buttons.close, clk: buttons.close.onClick, dis: vlcDisabled, clr: 'danger' },
		{ btn: buttons.tvOn, clk: buttons.tvOn.onClick, dis: tvDisabled, clr: 'success', badge: !tvDisabled && tvOn },
		{ btn: buttons.playPause, clk: buttons.playPause.onClick, dis: vlcDisabled, clr: 'success' },

		{ btn: buttons.audio, clk: () => props.onDialogOpen('audio-tracks') },
		{ btn: buttons.tvOff, clk: buttons.tvOff.onClick, dis: tvDisabled, clr: 'warning', badge: !tvDisabled && !tvOn },
		{ btn: buttons.volUp, clk: buttons.volUp.onClick },
		
		{ btn: buttons.addUrl, clk: () => props.onDialogOpen('url') },
		{ btn: buttons.volumes, clk: () => props.onDialogOpen('volumes') },
		{ btn: buttons.volDown, clk: buttons.volDown.onClick },

		{ btn: buttons.emptyPlaylist, clk: buttons.emptyPlaylist.onClick, dis: vlcDisabled },
		{ btn: buttons.mute, clk: buttons.mute.onClick },
		{ btn: buttons.playlist, clk: () => props.onDialogOpen('playlist'), dis: vlcDisabled },
	];

	return (
		<Stack
			direction="column"
			sx={{ height: '100%' }}
		>
			<ProgressBar {...progress} />

			<Grid container sx={{ flex: 1 }}>
				{btnConfs.map((btnConf, i) =>
					<Grid key={i} xs={(i + 1) % 3 ? 3 : 6}>
						<RemoteButton
							button={btnConf.btn}
							onClick={btnConf.clk}
							disabled={btnConf.dis}
							color={btnConf.clr}
							badgeContent={btnConf.badge}
						/>
					</Grid>
				)}
			</Grid>

			<IconButton
				size="lg"
				onClick={props.onContractClick}
			>
				<CloseFullscreenIcon />
			</IconButton>
		</Stack>
	);
}
