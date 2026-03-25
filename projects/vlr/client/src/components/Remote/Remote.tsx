import React, { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Box, useTheme } from '@mui/joy';
import SubtitlesDialog from './Dialogs/SubtitlesDialog';
import AudioTracksDialog from './Dialogs/AudioTracksDialog';
import PlaylistDialog from './Dialogs/PlaylistDialog';
import AddUrlDialog from './Dialogs/AddUrlDialog';
import VolumesDialog from './Dialogs/VolumesDialog';
import StatusDialog from './Dialogs/StatusDialog';
import SmallRemote from './Components/SmallRemote';
import FullRemote from './Components/FullRemote';
import { useVlcStatusState } from '../../state';

export type DialogKey = 'playlist' | 'subtitles' | 'audio-tracks' | 'volumes' | 'url' | 'status';

type IProps = {
	open: boolean;
	onOpen: () => void;
	onClose: () => void;
};

export default function Remote(props: IProps): React.ReactElement {
	const vlcStatus = useVlcStatusState(state => state.status);
	const { vars: { palette } } = useTheme();
	const [openDialogKey, setOpenDialogKey] = useState<DialogKey | null>(null);
	const swipeHandlers = useSwipeable({
		trackMouse: true,
		onSwipedLeft: props.onOpen,
		onSwipedRight: props.onClose,
	});
	const backgroundColor = props.open ? '' : palette.primary.softBg;
	
	return (
		<Box
			{...swipeHandlers}
			sx={{
				backgroundColor,
				height: '100%',
			}}
		>
			{!props.open &&
				<SmallRemote
					onDialogOpen={setOpenDialogKey}
					onExpandClick={props.onOpen}
				/>
			}
			{props.open &&
				<FullRemote
					onDialogOpen={setOpenDialogKey}
					onContractClick={props.onClose}
				/>
			}

			<PlaylistDialog
				open={openDialogKey === 'playlist'}
				onClose={() => setOpenDialogKey(null)}
			/>
			<SubtitlesDialog
				open={openDialogKey === 'subtitles'}
				delay={vlcStatus?.subtitleDelay || 0}
				tracks={vlcStatus?.subtitleTracks || []}
				onClose={() => setOpenDialogKey(null)}
			/>
			<AudioTracksDialog
				open={openDialogKey === 'audio-tracks'}
				tracks={vlcStatus?.audioTracks || []}
				onClose={() => setOpenDialogKey(null)}
			/>
			<AddUrlDialog
				open={openDialogKey === 'url'}
				onClose={() => setOpenDialogKey(null)}
			/>
			<VolumesDialog
				open={openDialogKey === 'volumes'}
				onClose={() => setOpenDialogKey(null)}
			/>
			<StatusDialog
				open={openDialogKey === 'status'}
				onClose={() => setOpenDialogKey(null)}
			/>
		</Box>
	);
}
