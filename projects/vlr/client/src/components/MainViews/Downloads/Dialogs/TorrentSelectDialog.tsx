import React, { useEffect, useState } from 'react';
import { Divider, FormLabel, List, ListDivider, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Stack, Typography } from '@mui/joy';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import Dialog from '../../../Dialog';
import { padZero, sortArrayByKey } from '../../../../functions';
import { MissingEpisodeListItem, TorrentLink } from '../../../../types';

type IProps = {
	open: boolean;
	episode: MissingEpisodeListItem | null;
	onClose: () => void;
	onSelect: (episodeId: number, torrentId: number) => void;
};

type IPropsTorrent = {
	link: TorrentLink;
	selected: boolean;
	onClick: () => void;
};

function Torrent(props: IPropsTorrent) {
	return (
		<>
			<ListItem>
				<ListItemButton onClick={props.onClick}>
					<ListItemDecorator>
						{props.selected ? <RadioButtonCheckedIcon /> : <RadioButtonUncheckedIcon />}
					</ListItemDecorator>
					<ListItemContent>
						<Typography level="body-md" sx={{ overflowWrap: 'break-word' }}>
							{props.link.fileName}
						</Typography>
						<Typography level="body-sm">
							Size: {props.link.fileSize}, Seeders: {props.link.seeders}
						</Typography>
					</ListItemContent>
				</ListItemButton>
			</ListItem>
			<ListDivider />
		</>
	);
}

export default function TorrentSelectDialog(props: IProps): React.ReactElement {
	const { id: episodeId, showName, episodeNumber, episodeName, torrents } = props.episode || {};
	const [torrentId, setTorrentId] = useState<number | null>(null);
	const [sortedTorrents, setSortedTorrents] = useState<TorrentLink[]>([]);
	const handleOnClose = () => {
		if (props.episode && episodeId && torrentId) {
			props.onSelect(episodeId, torrentId);
		}

		props.onClose();
	};

	useEffect(() => {
		if (props.open) {
			setSortedTorrents(sortArrayByKey(torrents || [], 'seeders').reverse());
		}
	}, [props.open, torrents]);

	return (
		<Dialog.Dialog
			open={props.open}
			title="Select Torrent"
			onCancel={props.onClose}
			primaryLabel="Download"
			onPrimaryAction={handleOnClose}
		>
			<FormLabel>
				<Stack direction="column">
					<Typography level="body-lg">{showName}</Typography>
					<Divider />
					<Typography fontWeight="lg" level="body-md">{padZero(episodeNumber || '')} - {episodeName}</Typography>
				</Stack>
			</FormLabel>

			<Dialog.MainContent>
				<List>
					{sortedTorrents.map(t =>
						<Torrent
							key={t.id}
							link={t}
							selected={t.id === torrentId}
							onClick={() => setTorrentId(t.id)}
						/>
					)}
				</List>
			</Dialog.MainContent>
		</Dialog.Dialog>
	);
}
