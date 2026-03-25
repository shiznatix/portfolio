import React, { useContext, useEffect, useState } from 'react';
import { List, Typography } from '@mui/joy';
import Dialog from '../../Dialog';
import { ApiContext } from '../../../context';
import { BrowseFile, SetPlaylistMethod } from '../../../types';
import { removeOrAppend } from '../../../functions';
import * as api from '../../../api';
import Loadable from '../../Loadable';
import FileListItem from '../../FileListItem/FileListItem';

interface IProps {
	open: boolean;
	showName: string;
	seasonNumber: string;
	onClose: () => void;
}

export default function SeasonViewDialog(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [seasonFiles, setSeasonFiles] = useState<BrowseFile[] | null>(null);
	const [selectedFiles, setSelectedFiles] = useState<BrowseFile[]>([]);
	const fetchSeasonFiles = () => apiCall(async () => {
		const res = await api.browseSeason(props.showName, props.seasonNumber);
		setSeasonFiles(res.reduce((prev, curr) => [...prev, ...curr.files], [] as BrowseFile[]));
	});
	const handleOnFileClick = (file: BrowseFile) => {
		setSelectedFiles(removeOrAppend(selectedFiles, file));
	};
	const handlePlaylistAction = (action: SetPlaylistMethod) => {
		apiCall(async () => {
			await api.setPlaylistPaths(selectedFiles.map(f => f.filePath), action);
			props.onClose();
		});
	};

	useEffect(() => {
		if (props.open && props.showName && props.seasonNumber) {
			fetchSeasonFiles();
		} else {
			setSeasonFiles(null);
			setSelectedFiles([]);
		}
	}, [props.open]);

	return (
		<Dialog.Dialog
			open={props.open}
			title={`${props.showName} - S${props.seasonNumber}`}
			primaryLabel="Play"
			onPrimaryAction={() => handlePlaylistAction('replace')}
			primaryButtonDisabled={selectedFiles.length === 0}
			secondaryLabel="Append"
			onSecondaryAction={() => handlePlaylistAction('append')}
			secondaryButtonDisabled={selectedFiles.length === 0}
			cancelLabel="Close"
			onCancel={props.onClose}
		>
			<Loadable loading={seasonFiles === null}>
				<Typography
					visibility={seasonFiles?.length === 0 ? 'visible' : 'hidden'}
					level="body-lg"
				>
					Season is empty
				</Typography>

				<List>
					{(seasonFiles || []).map((file, i) => (
						<FileListItem
							key={file.filePath}
							index={i}
							file={file}
							selected={selectedFiles.includes(file)}
							onClick={() => handleOnFileClick(file)}
							onUpdate={fetchSeasonFiles}
						/>
					))}
				</List>
			</Loadable>
		</Dialog.Dialog>
	);
}
