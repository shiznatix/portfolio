import React, { useMemo } from 'react';
import { Badge, Box, ColorPaletteProp, IconButton, Stack, Typography } from '@mui/joy';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { floatToPercent } from '../../../functions';
import { playProgress } from '../functions';
import { DialogKey } from '../Remote';
import VlcStateIcon from './VlcStateIcon';
import buttons from '../buttons';
import { usePlaylistState, useTvStatusState, useVlcStatusState } from '../../../state';
import { config } from '../../../config';

type IProps = {
	onDialogOpen: (key: DialogKey) => void;
	onExpandClick: () => void;
};

type IPropsRemoteButton = {
	icon: React.ReactElement;
	onClick: () => void;
	disabled?: boolean;
	color?: ColorPaletteProp;
	badgeContent?: number;
};

function RemoteButton(props: IPropsRemoteButton) {
	return (
		<IconButton
			onClick={props.onClick}
			color={props.color || 'primary'}
			variant="solid"
			disabled={props.disabled === true}
			size="sm"
			sx={{
				width: '100%',
			}}
		>
			<Badge
				size="sm"
				variant="soft"
				badgeContent={props.badgeContent || 0}
			>
				{props.icon}
			</Badge>
		</IconButton>
	);
}

export default function SmallRemote(props: IProps): React.ReactElement {
	const vlcStatus = useVlcStatusState(state => state.status);
	const tvStatus = useTvStatusState(state => state.status);
	const playlist = usePlaylistState(state => state.items);
	const progress = playProgress(vlcStatus);
	const tvOn = tvStatus?.power === 'on';
	const tvBtn = config.cecTvAddress ? (tvOn ? buttons.tvOff : buttons.tvOn) : null;
	const vlcOpen = !!(vlcStatus && vlcStatus?.state !== 'closed');
	const engSubTrack = useMemo(() => {
		const engTrack = vlcStatus?.subtitleTracks?.find(t => t.language.toLowerCase().includes('english'));

		if (engTrack) {
			return engTrack;
		}

		const emptyTrack = vlcStatus?.subtitleTracks?.length === 1 && vlcStatus?.subtitleTracks[0].language === '' ? vlcStatus?.subtitleTracks[0] : null;

		if (emptyTrack) {
			return emptyTrack;
		}
	}, [vlcStatus]);

	return (
		<Box sx={{ height: '100%' }}>
			<Box sx={{ height: '0%' }}>
				{progress &&
					<Typography textAlign="center">
						{progress.played}
					</Typography>
				}
				<Typography
					textAlign="center"
					level="body-sm"
					justifyContent="center"
					endDecorator={<VlcStateIcon state={vlcStatus?.state} />}
				>
					{floatToPercent(vlcStatus?.position || 0)}
				</Typography>
				{progress &&
					<Typography textAlign="center">
						{progress.duration}
					</Typography>
				}
			</Box>

			<Stack
				direction="column"
				spacing={2}
				justifyContent="center"
				sx={{ height: '100%' }}
			>
				{tvBtn &&
					<RemoteButton
						color={tvOn ? 'danger' : 'success'}
						icon={tvBtn.icon}
						onClick={tvBtn.onClick}
					/>
				}

				<RemoteButton
					icon={buttons.engSubs.icon}
					disabled={!vlcOpen || !engSubTrack}
					onClick={() => buttons.engSubs.onClick(engSubTrack?.id)}
				/>
				<RemoteButton
					icon={buttons.playlist.icon}
					disabled={!vlcOpen}
					onClick={() => props.onDialogOpen('playlist')}
					badgeContent={playlist.length}
				/>
				<RemoteButton
					icon={buttons.forward.icon}
					disabled={!vlcOpen}
					onClick={buttons.forward.onClick}
				/>
				<RemoteButton
					icon={buttons.volUp.icon}
					onClick={buttons.volUp.onClick}
				/>
				<RemoteButton
					icon={buttons.volDown.icon}
					onClick={buttons.volDown.onClick}
				/>
				<RemoteButton
					icon={buttons.fullscreen.icon}
					disabled={!vlcOpen}
					onClick={buttons.fullscreen.onClick}
				/>
				<RemoteButton
					icon={buttons.playPause.icon}
					disabled={!vlcOpen}
					onClick={buttons.playPause.onClick}
					color="success"
				/>
			</Stack>

			<IconButton
				variant="solid"
				color="primary"
				onClick={props.onExpandClick}
				size="lg"
				sx={{
					width: '100%',
					position: 'absolute',
					bottom: 0,
				}}
			>
				<OpenInFullIcon />
			</IconButton>
		</Box>
	);
}
