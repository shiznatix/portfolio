import React, { useContext, useEffect, useState } from 'react';
import { List, Typography } from '@mui/joy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Dialog from '../../Dialog';
import FileListItem from '../../FileListItem/FileListItem';
import Loadable from '../../Loadable';
import { ApiContext } from '../../../context';
import { PlaylistItem } from '../../../types';
import * as api from '../../../api';

type IProps = {
	open: boolean;
	onClose: () => void;
};

export default function PlaylistDialog(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [playlist, setPlaylist] = useState<PlaylistItem[] | null>(null);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const fetchPlaylist = () => apiCall(async () => {
		const plist = await api.playlist();

		setPlaylist(plist);
		setSelectedIndex(plist.findIndex(f => f.vlcItem.playing));
	});
	const onPlayAt = () => {
		apiCall(async () => {
			await api.playAt(selectedIndex);
			props.onClose();
		});
	};
	const onRemoveAt = () => {
		apiCall(async () => {
			await api.removeAt(selectedIndex);
			fetchPlaylist();
		});
	};

	useEffect(() => {
		if (props.open) {
			fetchPlaylist();
		} else {
			setPlaylist(null);
			setSelectedIndex(-1);
		}
	}, [props.open]);

	return (
		<Dialog.Dialog
			open={props.open}
			title="Playlist"
			primaryLabel="Play"
			primaryButtonDisabled={!playlist?.length}
			onPrimaryAction={onPlayAt}
			secondaryLabel='Remove'
			secondaryButtonDisabled={!playlist?.length}
			onSecondaryAction={onRemoveAt}
			cancelLabel='Close'
			onCancel={props.onClose}
		>
			<Loadable loading={playlist === null}>
				<Typography
					visibility={playlist?.length === 0 ? 'visible' : 'hidden'}
					level="body-lg"
				>
					Playlist is empty
				</Typography>

				<List>
					{(playlist || []).map((f, i) =>
						<FileListItem
							key={f.vlcItem.fileName}
							index={i}
							file={f}
							selected={i === selectedIndex}
							onClick={() => setSelectedIndex(i)}
							onUpdate={fetchPlaylist}
							endDecorator={f.vlcItem.playing && <PlayArrowIcon color="success" />}
							altSubText={f.vlcItem.filePath}
						/>
					)}
				</List>
			</Loadable>
		</Dialog.Dialog>
	);
}
