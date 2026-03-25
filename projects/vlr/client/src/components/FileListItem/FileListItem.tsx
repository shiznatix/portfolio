import React, { useContext, useMemo, useState } from 'react';
import { Box, Checkbox, Grid, ListDivider, ListItem, ListItemContent, ListItemDecorator, Stack, Typography, useTheme } from '@mui/joy';
import FolderIcon from '@mui/icons-material/Folder';
import PlayDisabledIcon from '@mui/icons-material/PlayDisabled';
import LabelIcon from '@mui/icons-material/Label';
import StarIcon from '@mui/icons-material/Star';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import UpdateIcon from '@mui/icons-material/Update';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import { IconCount, IconFileType, IconPlayedCount } from '../Icons';
import ConfirmButton from '../ConfirmButton';
import FileLabelsDialog from './Dialogs/FileLabelsDialog';
import { BrowseFile, FsEpisode, PlaylistItem, VlrFileAttrs } from '../../types';
import { padZero, parseFileName, timestampToStr } from '../../functions';
import { ApiContext } from '../../context';
import { config } from '../../config';
import * as api from '../../api';
import FlexChip from '../FlexChip';

export type File = BrowseFile | FsEpisode | PlaylistItem;

type ComputedProps = {
	playable: boolean;
	isDir: boolean;
	clickable: boolean;
	endDecorator: React.ReactNode;
	fileName: string;
	parsedFileName: ReturnType<typeof parseFileName>;
	filePath: string;
	showName: string | null;
	seasonNumber: string | null;
	modifiedTime: string | null;
	playedCount: number;
	lastPlayedTime: string | null;
	autoDownloaded: boolean;
	skipInRandom: boolean;
	starred: boolean;
	labels: string[];
	inLabelsDir: boolean;
	inShowsDir: boolean;
};

type IProps<T extends File> = {
	index: number;
	file: T;
	onUpdate: (newVals: Partial<VlrFileAttrs>) => void;
	onClick?: () => void;
	endDecorator?: React.ReactNode;
	selected?: boolean;
	altSubText?: string;
};

function SelectCheckbox(props: { checked: boolean }): React.ReactElement {
	return (
		<Checkbox
			size="lg"
			color="primary"
			variant="outlined"
			checked={props.checked}
		/>
	);
}

function IconedText(props: { icon?: React.ReactNode; text: string }): React.ReactElement {
	return (
		<Typography
			level="body-xs"
			startDecorator={props.icon}
			slotProps={{
				startDecorator: {
					sx: {
						margin: 0,
					},
				},
			}}
			// fontWeight="bold"
		>
			{props.text}
		</Typography>
	);
}

const inLabelsDir = (filePath: string) => {
	return !!(config.labelDirs && config.labelDirs.find(d => filePath.startsWith(d)));
};
const inShowsDir = (filePath: string) => {
	return !!(config.showDirs && config.showDirs.find(d => filePath.startsWith(d)));
};

function computeProps<T extends File>(file: T, selected: boolean): ComputedProps {
	switch (file.discriminator) {
		case 'playlistItem':
			return {
				playable: true,
				isDir: false,
				clickable: true,
				endDecorator: selected ? <RadioButtonCheckedIcon color="primary" /> : <RadioButtonUncheckedIcon />,
				fileName: file.vlcItem.fileName,
				parsedFileName: parseFileName(file.vlcItem.fileName),
				filePath: file.vlcItem.filePath,
				showName: file.fsEpisode?.showName || null,
				seasonNumber: file.fsEpisode?.seasonNumber || null,
				modifiedTime: null,
				playedCount: file.fsEpisode?.playedCount || 0,
				lastPlayedTime: (file.fsEpisode?.lastPlayedTime || 0) > 0 ? timestampToStr(file.fsEpisode?.lastPlayedTime) : null,
				autoDownloaded: !!file.fsEpisode?.autoDownloaded,
				skipInRandom: !!file.fsEpisode?.skipInRandom,
				starred: !!file.fsEpisode?.starred,
				labels: file.fsEpisode?.labels || [],
				inLabelsDir: inLabelsDir(file.vlcItem.filePath),
				inShowsDir: inShowsDir(file.vlcItem.filePath),
			};
		case 'browseFile':
			const parsedFileName = parseFileName(file.fileName, file.isDir || !file.playableExtension);

			return {
				playable: file.playableExtension,
				isDir: file.isDir,
				clickable: file.isDir || file.playableExtension,
				endDecorator: file.isDir ? <Typography level="body-lg"><FolderIcon /></Typography>
					: file.playableExtension ? <SelectCheckbox checked={selected} />
					: parsedFileName.extension === 'srt' ? <SubtitlesIcon />
					: <PlayDisabledIcon />,
				fileName: file.fileName,
				parsedFileName: parsedFileName,
				filePath: file.filePath,
				showName: null,
				seasonNumber: null,
				modifiedTime: timestampToStr(file.modifiedTime),
				playedCount: file.playedCount || 0,
				lastPlayedTime: (file.lastPlayedTime || 0) > 0 ? timestampToStr(file.lastPlayedTime) : null,
				autoDownloaded: !!file.autoDownloaded,
				skipInRandom: !!file.skipInRandom,
				starred: !!file.starred,
				labels: file.labels || [],
				inLabelsDir: inLabelsDir(file.filePath),
				inShowsDir: inShowsDir(file.filePath),
			};
		case 'fsEpisode':
			return {
				playable: true,
				isDir: false,
				clickable: true,
				endDecorator: <SelectCheckbox checked={selected} />,
				fileName: file.fileName,
				parsedFileName: parseFileName(file.fileName),
				filePath: file.filePath,
				showName: file.showName,
				seasonNumber: file.seasonNumber || null,
				modifiedTime: null,
				playedCount: file.playedCount || 0,
				lastPlayedTime: (file.lastPlayedTime || 0) > 0 ? timestampToStr(file.lastPlayedTime) : null,
				autoDownloaded: file.autoDownloaded,
				skipInRandom: file.skipInRandom,
				starred: file.starred,
				labels: file.labels || [],
				inLabelsDir: inLabelsDir(file.filePath),
				inShowsDir: inShowsDir(file.filePath),
			};
	}
}

export default function FileListItem<T extends File>(props: IProps<T>): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const { vars: { palette } } = useTheme();
	const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);
	const compProps = useMemo(() => computeProps(props.file, props.selected || false), [props.file, props.selected]);
	const handleXattrChange = (xattr: keyof VlrFileAttrs, val: string) => {
		apiCall(async () => {
			const res = await api.setXAttrValue(compProps.filePath, xattr, val);

			props.onUpdate({ [xattr]: res });
		});
	};
	const handleLabelsUpdate = (labels: string[]) => {
		props.onUpdate({ labels });
	};
	const onLabelsClick = (e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation();
		setLabelsDialogOpen(true);
	};
	const backgroundColor = props.selected ? palette.primary.plainActiveBg :
		props.index % 2 ? 'transparent' :
		palette.neutral.softBg;

	return (
		<>
			<Box sx={{
				backgroundColor,
				borderRadius: '5px',
			}}>
				<ListItem
					onClick={props.onClick}
					sx={{
						padding: 0,
						margin: 0,
					}}
				>
					<Grid
						container
						columns={14}
						sx={{ width: '100%' }}
					>
						<Grid xs={2} textAlign="center">
							{compProps.clickable && compProps.inLabelsDir &&
								<ListItemDecorator sx={{ margin: 0, minInlineSize: 0 }}>
									<Stack
										direction="column"
										spacing={0.3}
									>
										<ConfirmButton
											size="md"
											component="chip"
											variant={compProps.starred ? 'soft' : 'outlined'}
											defaultColor={compProps.starred ? 'success' : 'neutral'}
											confirmColor={compProps.starred ? 'danger' : 'success'}
											icon={compProps.starred ? <StarIcon /> : <StarOutlineIcon />}
											onConfirm={() => handleXattrChange('starred', compProps.starred ? '0' : '1')}
										/>
										<FlexChip
											size="md"
											variant="soft"
											color="primary"
											onClick={onLabelsClick}
											withBorder={true}
										>
											<LabelIcon />
										</FlexChip>
									</Stack>
								</ListItemDecorator>
							}
						</Grid>
						<Grid xs={12}>
							<ListItemContent sx={{ display: 'flex', height: '100%' }}>
								<Box sx={{
									height: '100%',
									minWidth: '1%',
									display: 'flex',
									flexDirection: 'column',
									flexGrow: 1,
									alignItems: 'start',
									justifyContent: 'center',
								}}>
									<Stack direction="row" spacing={1.5}>
										{compProps.parsedFileName.episodeNumber &&
											<IconedText
												icon={<IconCount />}
												text={compProps.parsedFileName.episodeNumber}
											/>
										}
										{compProps.parsedFileName.extension &&
											<IconedText
												icon={<IconFileType />}
												text={compProps.parsedFileName.extension}
											/>
										}
									</Stack>

									<Typography
										level="body-lg"
										sx={{
											overflowWrap: 'break-word',
											width: '100%',
											fontWeight: compProps.isDir || compProps.playable ? 'bolder' : 'normal',
										}}
									>
										{compProps.parsedFileName.name}
									</Typography>

									{compProps.showName &&
										<Typography level="body-sm" color="primary">
											{compProps.showName} - S{padZero(compProps.seasonNumber || 0)}
										</Typography>
									}
									{!compProps.showName && props.altSubText &&
										<Typography level="body-sm">
											{props.altSubText}
										</Typography>
									}
								</Box>
								<Box sx={{
									display: 'flex',
									alignItems: 'center',
									paddingRight: 0.5,
								}}>
									{compProps.endDecorator}
								</Box>
								{props.endDecorator &&
									<Box sx={{
										paddingLeft: 0.5,
										display: 'flex',
										alignItems: 'center',
									}}>
										{props.endDecorator}
									</Box>
								}
							</ListItemContent>
						</Grid>
					</Grid>
				</ListItem>
				{compProps.playable &&
					<ListItem
						onClick={props.onClick}
						sx={{
							minHeight: 0,
							padding: 0,
							paddingBottom: 0.5,
							margin: 0,
						}}
					>
						<Grid
							container
							columns={14}
							sx={{ width: '100%' }}
						>
							<Grid xs={2} display="flex" justifyContent="center">
								{compProps.modifiedTime &&
									<IconedText
										icon={<UpdateIcon />}
										text={compProps.modifiedTime}
									/>
								}
							</Grid>

							<Grid xs={3} textAlign="center">
								<ConfirmButton
									size="md"
									component="chip"
									variant="soft"
									disableClick={!compProps.inShowsDir || compProps.playedCount === 0}
									defaultColor={compProps.playedCount > 0 ? 'success' : 'warning'}
									icon={compProps.playedCount > 0 ? <IconPlayedCount /> : <VisibilityOffIcon />}
									label={compProps.playedCount || 'no'}
									onConfirm={() => handleXattrChange('playedCount', '0')}
									sx={{ maxWidth: '100%', width: '100%' }}
								/>
							</Grid>

							<Grid xs={3} textAlign="center">
								<ConfirmButton
									size="md"
									component="chip"
									variant="soft"
									defaultColor="primary"
									disableClick={!compProps.inShowsDir}
									icon={compProps.lastPlayedTime ? <PlayArrowIcon /> : <PlayDisabledIcon />}
									label={compProps.lastPlayedTime || 'no'}
									onConfirm={() => handleXattrChange('lastPlayedTime', '0')}
								/>
							</Grid>

							<Grid xs={3} textAlign="center">
								<ConfirmButton
									size="md"
									component="chip"
									variant="soft"
									disableClick={!compProps.inShowsDir}
									defaultColor={compProps.autoDownloaded ? 'success' : 'warning'}
									icon={<FileDownloadIcon />}
									label={compProps.autoDownloaded ? 'yes' : 'no'}
									onConfirm={() => handleXattrChange('autoDownloaded', compProps.autoDownloaded ? '0' : '1')}
								/>
							</Grid>
							<Grid xs={3} textAlign="center">
								<ConfirmButton
									size="md"
									component="chip"
									variant="soft"
									disableClick={!compProps.inShowsDir}
									defaultColor={compProps.skipInRandom ? 'warning' : 'success'}
									label={compProps.skipInRandom ? 'off' : 'on'}
									icon={<ShuffleIcon />}
									onConfirm={() => handleXattrChange('skipInRandom', compProps.skipInRandom ? '0' : '1')}
								/>
							</Grid>
						</Grid>
					</ListItem>
				}
			</Box>

			<ListDivider />

			{compProps.inLabelsDir &&
				<FileLabelsDialog
					open={labelsDialogOpen}
					fileName={compProps.fileName}
					filePath={compProps.filePath}
					labels={compProps.labels}
					onUpdate={handleLabelsUpdate}
					onClose={() => setLabelsDialogOpen(false)}
				/>
			}
		</>
	);
}
