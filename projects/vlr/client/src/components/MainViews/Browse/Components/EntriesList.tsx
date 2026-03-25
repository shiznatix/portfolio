import React, { CSSProperties, useCallback, useEffect, useMemo, useRef } from 'react';
import { VariableSizeList, areEqual } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Box, List } from '@mui/joy';
import FileListItem from '../../../FileListItem/FileListItem';
import DividerLine from '../../../DividerLine';
import { BrowseEntry, BrowseFile } from '../../../../types';
import { parseFilePath, stripPrefix } from '../../../../functions';
import { config } from '../../../../config';

type IPropsBrowseFile = {
	discriminator: 'file';
	file: BrowseFile;
	selected: boolean;
};

type IPropsLabels = {
	discriminator: 'labels';
	labels: string[];
};

type IProps = {
	viewType: 'labels' | 'directory';
	entries: BrowseEntry[];
	selectedPaths: string[];
	onSelect: (entry: BrowseFile) => void;
	onFileUpdate: (entry: BrowseFile, newVals: Partial<BrowseFile>) => void;
};

type IPropsEntryItem = {
	style: CSSProperties;
	index: number;
	data: {
		viewType: 'labels' | 'directory';
		entries: (IPropsBrowseFile | IPropsLabels)[];
		onSelect: (entry: BrowseFile) => void;
		onUpdate: (entry: BrowseFile, newVals: Partial<BrowseFile>) => void;
		setSize: (index: number, size: number) => void;
	};
};

const EntryItem = React.memo(({ data, style, index }: IPropsEntryItem) => {
	const ref = useRef<HTMLDivElement | null>(null);
	const entry = data.entries[index];
	let subText;
	
	if (data.viewType === 'labels' && entry.discriminator === 'file') {
		const parsed = parseFilePath(entry.file.filePath, config.showDirs);

		if (parsed?.showName && parsed?.showName !== entry.file.fileName) {
			subText = parsed.showName;
		} else {
			subText = stripPrefix(entry.file.filePath, config.mediaDriveDirs).replace(`/${entry.file.fileName}`, '');
		}
	}

	useEffect(() => {
		const height = ref.current?.getBoundingClientRect().height;

		if (height) {
			data.setSize(index, height);
		}
	}, []);

	return (
		<Box style={style}>
			<Box ref={ref} sx={{ padding: 0.5, paddingBottom: 0 }}>
				{entry.discriminator === 'labels' &&
					<DividerLine labels={entry.labels} />
				}
				{entry.discriminator === 'file' &&
					<FileListItem
						key={entry.file.filePath}
						index={index}
						file={entry.file}
						selected={entry.selected}
						onClick={() => data.onSelect(entry.file)}
						onUpdate={vals => data.onUpdate(entry.file, vals)}
						altSubText={subText}
					/>
				}
			</Box>
		</Box>
	);
}, areEqual);

export default function EntriesList(props: IProps): React.ReactElement {
	const listRef = useRef<VariableSizeList | null>(null);
	const sizeMap = useRef<Record<number, number>>({});
	const setSize = useCallback((index: number, size: number) => {
		sizeMap.current = { ...sizeMap.current, [index]: size };
		listRef.current?.resetAfterIndex(index);
	}, []);
  	const getSize = (index: number) => sizeMap.current[index] || 50;
	const itemData = useMemo(() => {
		const entries: (IPropsBrowseFile | IPropsLabels)[] = [];

		for (const entry of props.entries) {
			if (entry.discriminator === 'labels') {
				entries.push({
					discriminator: 'labels',
					labels: entry.labels,
				});
			}

			for (const file of entry.files) {
				entries.push({
					discriminator: 'file',
					file,
					selected: props.selectedPaths.includes(file.filePath),
				});
			}
		}
		
		return {
			entries,
			viewType: props.viewType,
			onSelect: props.onSelect,
			onUpdate: props.onFileUpdate,
			setSize,
		};
	}, [props.viewType, props.entries, props.selectedPaths]);

	return (
		<List sx={{ height: '100%' }}>
			<AutoSizer>
				{({ height, width }) => 
					<VariableSizeList
						ref={listRef}
						height={height}
						itemCount={itemData.entries.length}
						itemSize={getSize}
						width={width}
						itemData={itemData}
					>
						{EntryItem}
					</VariableSizeList>
				}
			</AutoSizer>
		</List>
	);
}
