import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/joy';
import EntriesList from './Components/EntriesList';
import PlaylistButtons from '../../PlaylistButtons';
import Source from './Components/Source';
import ListActions from './Components/ListActions';
import { ApiContext } from '../../../context';
import { getLastBrowsePath, getLastBrowseSortBy, saveLastBrowsePath } from '../../../local-storage';
import { removeByKeyValue, removeOrAppend, updateByValue } from '../../../functions';
import { BrowseEntry, BrowseFile, BrowseMutators, SetPlaylistMethod } from '../../../types';
import * as api from '../../../api';
import { useViewState } from '../../../state';
import DividerLine from '../../DividerLine';
import Loadable from '../../Loadable';

export const defaultMutators: BrowseMutators = {
	xattr: ['seen', 'auto-downloaded'],
	sortDirection: 'desc',
	sortBy: getLastBrowseSortBy(),
	search: '',
};

export default function Browse(): React.ReactElement {
	const defaultPath = useMemo(() => getLastBrowsePath(), []);
	const apiCall = useContext(ApiContext);
	const viewKey = useViewState(state => state.viewKey);
	const open = viewKey === 'browse';
	const [path, setPath] = useState(defaultPath);
	const [labels, setLabels] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [mutators, setMutators] = useState<BrowseMutators>(defaultMutators);
	const [allEntries, setAllEntries] = useState<BrowseEntry[]>([]);
	const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
	const [hasEntryLabels, setHasEntryLabels] = useState(false);
	const listEntries = useMemo(() => {
		const sortNum = mutators.sortDirection === 'desc' ? 1 : -1;
		const listEntries = structuredClone(allEntries);
		
		for (const entry of listEntries) {
			entry.files = entry.files.filter(f => {
				if (!f.fileName.toLowerCase().includes(mutators.search)) {
					return false;
				}
				if (!mutators.xattr.includes('auto-downloaded')) {
					return f.autoDownloaded === false;
				}
				if (!mutators.xattr.includes('seen')) {
					return f.playedCount === 0;
				}
		
				return true;
			});

			if (mutators.sortBy === 'name') {
				entry.files.sort((a, b) => {
					if (a.starred !== b.starred) {
						return a.starred ? -1 : 1;
					}

					return (a.fileName > b.fileName) ? sortNum : ((b.fileName > a.fileName) ? (sortNum * -1) : 0);
				});
			} else if (mutators.sortBy === 'newest') {
				entry.files.sort((a, b) => {
					if (a.starred !== b.starred) {
						return a.starred ? -1 : 1;
					}

					return (a.modifiedTime < b.modifiedTime) ? sortNum : ((b.modifiedTime < a.modifiedTime) ? (sortNum * -1) : 0);
				});
			}
		}

		return listEntries;
	}, [mutators, allEntries]);
	const totalFiles = listEntries.reduce((prev, curr) => prev + curr.files.length, 0);
	const onPathChange = useCallback((path: string) => {
		setLabels([]);
		setPath(path);
	}, []);
	const onLabelsChange = useCallback((labels: string[]) => {
		setLabels(labels);
	}, []);
	const onEntrySelect = useCallback((file: BrowseFile) => {
		if (file.isDir) {
			onPathChange(file.filePath);
		} else if (file.playableExtension) {
			setSelectedPaths(selectedPaths => removeOrAppend(selectedPaths, file.filePath));
		}
	}, []);
	const onMutatorsChange = useCallback((vals: Partial<BrowseMutators>) => {
		setMutators(mutators => ({
			...mutators,
			...vals,
		}));
	}, []);
	const onSelectedPathsChange = useCallback((paths: string[]) => {
		setSelectedPaths(paths);
	}, []);
	const onFileUpdate = useCallback((file: BrowseFile, newVals: Partial<BrowseFile>) => {
		setAllEntries(allEntries => {
			const copy = structuredClone(allEntries);

			for (const entry of copy) {
				if (entry.discriminator === 'labels' && newVals.labels) {
					if (!labels.find(l => newVals.labels?.includes(l))) {
						entry.files = removeByKeyValue(entry.files, 'filePath', file.filePath);
						continue;
					}
				}

				entry.files = updateByValue(entry.files, newVals, e => e.filePath === file.filePath, true);
			}

			return copy;
		});
	}, []);
	const onPlaylistAction = useCallback((method: SetPlaylistMethod) => apiCall(async () => {
			await api.setPlaylistPaths(selectedPaths, method);
			setSelectedPaths([]);
	}), [selectedPaths]);

	useEffect(() => {
		if (open) {
			apiCall(setIsLoading, async () => {
				let entries: BrowseEntry[] = [];

				onMutatorsChange({ search: '' });

				if (labels.length > 0) {
					entries = await api.browseLabels(path, labels);
				} else {
					entries = await api.browsePath(path);
				}

				setAllEntries(entries);
				setSelectedPaths([]);
				saveLastBrowsePath(path);
			});
		}
	}, [open, path, labels]);
	useEffect(() => {
		if (open) {
			apiCall(async () => {
				const res = await api.labels(path);
				setHasEntryLabels(res.length > 0);
			});
		}
	}, [open, path]);

	return (
		<Box
			hidden={!open}
			sx={{
				height: '100%',
				display: 'flex',
				flexFlow: 'column',
			}}
		>
			<Box>
				<Source
					path={path}
					hasEntryLabels={hasEntryLabels}
					onPathChange={onPathChange}
					onLabelsChange={onLabelsChange}
				/>
			</Box>

			<Box sx={{ margin: 0.5 }}>
				<ListActions
					entries={allEntries}
					selectedPaths={selectedPaths}
					onMutatorsChange={onMutatorsChange}
					onSelectedPathsChange={onSelectedPathsChange}
				/>
			</Box>

			<DividerLine label={isLoading ? '...' : `Count: ${totalFiles}`} />
			<Box sx={{ flex: 1, overflowY: 'auto' }}>
				<Loadable loading={isLoading}>
					<EntriesList
						viewType={labels.length > 0 ? 'labels' : 'directory'}
						entries={listEntries}
						selectedPaths={selectedPaths}
						onSelect={onEntrySelect}
						onFileUpdate={onFileUpdate}
					/>
				</Loadable>
			</Box>
			<Box sx={{ height: '10%' }}>
				<PlaylistButtons
					loading={false}
					disabled={selectedPaths.length < 1}
					onClick={onPlaylistAction}
				/>
			</Box>
		</Box>
	);
}
