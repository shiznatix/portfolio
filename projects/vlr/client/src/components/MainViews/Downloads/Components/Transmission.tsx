import React, { useContext, useEffect, useState } from 'react';
import { ButtonGroup, IconButton, LinearProgress, List, ListItem, ListItemContent, ListItemDecorator, Tooltip, Typography } from '@mui/joy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadOffIcon from '@mui/icons-material/FileDownloadOff';
import PendingIcon from '@mui/icons-material/Pending';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MotionPhotosOffIcon from '@mui/icons-material/MotionPhotosOff';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import Loadable from '../../../Loadable';
import { ApiContext } from '../../../../context';
import { arrayUnique, removeByValue } from '../../../../functions';
import { DownloadAction, TorrentDownload } from '../../../../types';
import * as api from '../../../../api';
import ConfirmButton from '../../../ConfirmButton';

type IProps = {
	open: boolean;
};

type IPropsDownloadDecorator = TorrentDownload;

type IPRopsDownload = {
	download: TorrentDownload;
	loading: boolean;
	onAction: (action: DownloadAction) => void;
};

function percentStrToNum(percent: string) {
	return parseInt(percent.replace('%', '').trim(), 10) || 0;
}

function downloadToSortable(download: TorrentDownload) {
	const donePercent = (100 - percentStrToNum(download.donePercent)).toString().padStart(3, '0');
	let status = 'a';

	if (download.status === 'up & down') {
		status = 'b';
	}
	if (download.status === 'downloading') {
		status = 'c';
	}
	if (download.status === 'seeding') {
		status = 'd';
	}
	if (download.status === 'stopped') {
		status = 'e';
	}
	if (download.status === 'idle') {
		status = 'f';
	}
	if (download.status === 'queued') {
		status = 'g';
	}

	return `${status}${donePercent}`;
}

function DownloadDecorator(props: IPropsDownloadDecorator) {
	if (props.status === 'stopped') {
		// TODO color is correct here but because icons come from `@mui` the types are off.
		//   Fix the types with some global override or something
		// @ts-ignore
		return <FileDownloadOffIcon color="danger" />;
	}
	if (props.status === 'idle') {
		return <PendingIcon color="warning" />;
	}
	if (props.status === 'downloading') {
		return <FileDownloadIcon color="success" />;
	}
	if (props.status === 'up & down') {
		return <ImportExportIcon color="success" />
	}
	if (props.status === 'seeding') {
		return <FileUploadIcon color="primary" />
	}
	if (props.status === 'queued') {
		return <MotionPhotosOffIcon color="primary" />;
	}

	return <QuestionMarkIcon color="primary" />;
}

function Download(props: IPRopsDownload) {
	return (
		<>
			<ListItem>
				<ListItemDecorator>
					<Tooltip
						title={props.download.status}
						size="sm"
						// placement="right"
					>
						<IconButton>
							<DownloadDecorator {...props.download} />
						</IconButton>
					</Tooltip>
				</ListItemDecorator>
				<ListItemContent>						
					<Typography level="body-md" sx={{ overflowWrap: 'break-word' }}>
						{props.download.donePercent} ({props.download.amountDownloaded} at {props.download.downloadSpeed}) {props.download.eta}
					</Typography>
					<Typography level="body-sm" sx={{ overflowWrap: 'break-word' }}>
						{props.download.name}
					</Typography>
					<LinearProgress
						determinate
						size="md"
						thickness={15}
						value={percentStrToNum(props.download.donePercent)}
					>
						<Typography
							level="body-xs"
							fontWeight="xl"
							sx={{ mixBlendMode: 'difference' }}
						>
							{props.download.donePercent}
						</Typography>
					</LinearProgress>
				</ListItemContent>
				<Loadable loading={props.loading}>
					<ButtonGroup orientation="vertical" size="sm">
						<IconButton
							hidden={props.download.simpleStatus !== 'paused'}
							onClick={() => props.onAction('start')}
						>
							<PlayArrowIcon />
							{/* <CircularProgress /> */}
						</IconButton>
						<IconButton
							hidden={'downloading' !== props.download.simpleStatus}
							onClick={() => props.onAction('pause')}
						>
							<PauseIcon />
						</IconButton>
						<ConfirmButton
							onConfirm={() => props.onAction('delete')}
						/>
					</ButtonGroup>
				</Loadable>
			</ListItem>
		</>
	);
}

export default function Transmission(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [downloads, setDownloads] = useState<TorrentDownload[]>([]);
	const [loadingIds, setLoadingIds] = useState<string[]>([]);
	const fetchDownloads = () => apiCall(async () => {
		const downloads = (await api.downloads()).map(d => ({
			...d,
			status: d.status.toLowerCase(),
		}));

		downloads.sort((a, b) => {
			const x = downloadToSortable(a);
			const y = downloadToSortable(b);
			
			return x > y ? 1 : (x < y ? -1 : 0);
		});

		setDownloads(downloads);
	});
	const onAction = (download: TorrentDownload | null, action: DownloadAction) => apiCall(async () => {
		if (!download) {
			return;
		}

		// TODO this isn't totally working. Looks like the action call and subsequet `fetchDownloads` call run super fast
		//   But Transmission hasn't really updated at that point, so the buttons and whatnot are incorrect?
		//    FE can return to `loading=false` when the `downloads` matches the correct state?
		//      BE could do that too?
		setLoadingIds(arrayUnique([
			...loadingIds,
			download.id,
		]));
		
		await api.downloadAction(download.id, action);
		await fetchDownloads();

		setLoadingIds(removeByValue(loadingIds, download.id));
	});
	
	useEffect(() => {
		if (props.open) {
			fetchDownloads();
	
			const timer = setInterval(() => fetchDownloads(), 5000);

			return () => clearTimeout(timer);
		} else {
			setLoadingIds([]);
		}
	}, [props.open]);

	return (
		<List>
			{downloads.map((download) => (
				<Download
					key={download.id}
					download={download}
					loading={loadingIds.includes(download.id)}
					onAction={action => onAction(download, action)}
				/>
			))}
		</List>
	);
}
