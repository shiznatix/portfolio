import React, { useEffect, useMemo, useState } from 'react';
import { Button, ButtonGroup, IconButton } from '@mui/joy';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { IconCheckBoxChecked, IconCheckBoxUnChecked } from '../../../Icons';
import Filters from './Filters';
import SearchBar from '../../../SearchBar';
import { defaultMutators } from '../Browse';
import { arrayUnique, parseFileName, removeOrAppend, ucfirst } from '../../../../functions';
import { saveLastBrowseSortBy } from '../../../../local-storage';
import { BrowseEntry, BrowseFilter, BrowseMutators, BrowseSortBy, SortDirection } from '../../../../types';

type IProps = {
	entries: BrowseEntry[];
	selectedPaths: string[];
	onMutatorsChange: (vals: Partial<BrowseMutators>) => void;
	onSelectedPathsChange: (paths: string[]) => void;
};

export default function ListActions(props: IProps): React.ReactElement {
	const [allChecked, setAllChecked] = useState(false);
	const [sortDirection, setSortDirection] = useState<SortDirection>(defaultMutators.sortDirection);
	const [sortBy, setSortBy] = useState<BrowseSortBy>(defaultMutators.sortBy);
	const [xattrFilters, setXattrFilters] = useState<BrowseFilter[]>(defaultMutators.xattr);
	const searchFileNames = useMemo(() => {
		return arrayUnique(props.entries.reduce((prev, curr) => [...prev, ...curr.files.map(f => f.fileName)], [] as string[]))
			.map(f => parseFileName(f).name);
	}, [props.entries]);
	const playableFilePaths = useMemo(() => {
		const playableFilePaths = [];

		for (const entry of props.entries) {
			for (const file of entry.files) {
				if (file.playableExtension) {
					playableFilePaths.push(file.filePath);
				}
			}
		}

		return playableFilePaths;
	}, [props.entries]);
	const onSearchChange = (search: string) => {
		props.onMutatorsChange({ search });
	};
	const onSelectAllClick = () => {
		const newAllChecked = !allChecked;

		setAllChecked(newAllChecked);
		props.onSelectedPathsChange(newAllChecked ? playableFilePaths : []);
	};
	const toggleSortDirection = () => {
		const newDirection = sortDirection === 'desc' ? 'asc' : 'desc';

		setSortDirection(newDirection);
		props.onMutatorsChange({ sortDirection: newDirection });
	};
	const toggleSortBy = () => {
		const newSortBy = sortBy === 'name' ? 'newest' : 'name';

		setSortBy(newSortBy);
		props.onMutatorsChange({ sortBy: newSortBy });
		saveLastBrowseSortBy(sortBy);
	};
	const toggleFilter = (filter: BrowseFilter) => {
		const newXattrFilters = removeOrAppend(xattrFilters, filter);

		setXattrFilters(newXattrFilters);
		props.onMutatorsChange({ xattr: newXattrFilters });
	};

	useEffect(() => {
		setAllChecked(false);
	}, [props.entries]);
	useEffect(() => {
		setAllChecked(playableFilePaths.length > 0 && playableFilePaths.every(p => props.selectedPaths.includes(p)));
	}, [props.selectedPaths, playableFilePaths]);

	return (
		<SearchBar
			searchOptions={searchFileNames}
			onSearchChange={onSearchChange}
		>
			<IconButton
				variant="outlined"
				size="sm"
				color="primary"
				disabled={playableFilePaths.length === 0}
				onClick={onSelectAllClick}
			>
				{allChecked ? <IconCheckBoxChecked /> : <IconCheckBoxUnChecked />}
			</IconButton>

			<ButtonGroup size="sm">
				<IconButton onClick={toggleSortDirection}>
					{sortDirection === 'desc' ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
				</IconButton>
				<Button onClick={toggleSortBy}>
					{ucfirst(sortBy)}
				</Button>
			</ButtonGroup>

			<Filters
				selectedFilters={xattrFilters}
				onClick={toggleFilter}
			/>
		</SearchBar>
	);
}
