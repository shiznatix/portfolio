import React, { useEffect, useMemo, useState } from 'react';
import { IconButton, List, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Typography } from '@mui/joy';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { addBookmark, deleteBookmark, getBookmarks } from '../../../../local-storage';
import { sortArrayByKey } from '../../../../functions';
import Dialog from '../../../Dialog';
import { config } from '../../../../config';

type Bookmark = {
	path: string;
	parsed: string;
};

type IProps = {
	open: boolean;
	path: string;
	onSelect: (path: string) => void;
	onClose: () => void;
};

export default function BookmarksDialog(props: IProps): React.ReactElement {
	const defaultPaths = useMemo(() => getBookmarks(), []);
	const [paths, setPaths] = useState<string[]>(defaultPaths);
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
	const [confirmDeletePath, setConfirmDeletePath] = useState<string>('');
	const handleAddCurrent = () => {
		addBookmark(props.path);
		setPaths(getBookmarks());
	};
	const handleDelete = (path: string) => {
		if (confirmDeletePath === path) {
			deleteBookmark(path);
			setPaths(getBookmarks());
		} else {
			setConfirmDeletePath(path);
		}
	};
	const handleSelect = (path: string) => {
		props.onSelect(path);
		props.onClose();
	};

	useEffect(() => {
		const showDirs = config.showDirs || [];
		
		// TODO make this work better with Seasons and Movies or whatever
		setBookmarks(paths.map(path => {
			let parsed = path;

			for (const dir of showDirs) {
				if (path.startsWith(dir)) {
					const parts = path.replace(dir, '').split('/').filter(p => p);
					const lastPart = parts[parts.length - 1];

					if (!lastPart) {
						parsed = dir.split('/').pop() || dir;
					} else if (lastPart.toLowerCase().startsWith('season')) {
						parsed = `${parts[0]} - S${lastPart.split(' ').pop()}`;
					} else {
						parsed = parts.join('/');
					}

					break;
				}
			}

			return {
				path,
				parsed,
			};
		}));
	}, [paths]);

	return (
		<Dialog.Dialog
			open={props.open}
			title="Bookmarks"
			primaryLabel="Add Current"
			primaryButtonDisabled={!!bookmarks.find(b => b.path === props.path)}
			onPrimaryAction={handleAddCurrent}
			cancelLabel="Close"
			onCancel={props.onClose}
		>
			<List size="lg">
				{sortArrayByKey(bookmarks, 'parsed').map(b =>
					<ListItem
						key={b.path}
						endAction={
							<IconButton
								variant="plain"
								color="danger"
								size="sm"
								onClick={() => handleDelete(b.path)}
							>
								{confirmDeletePath === b.path && <DeleteForeverIcon />}
								{confirmDeletePath !== b.path && <DeleteIcon />}
							</IconButton>
						}
					>
						<ListItemButton onClick={() => handleSelect(b.path)}>
							<ListItemDecorator>
								<LaunchIcon />
							</ListItemDecorator>
							<ListItemContent>
								<Typography noWrap>{b.parsed}</Typography>
							</ListItemContent>
						</ListItemButton>
					</ListItem>
				)}
			</List>
		</Dialog.Dialog>
	);
}
