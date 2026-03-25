import React, { useEffect, useState } from 'react';
import { Box, Button, ButtonGroup, Dropdown, IconButton, Menu, MenuButton, MenuItem, Stack, Typography } from '@mui/joy';
import LabelIcon from '@mui/icons-material/Label';
import CancelIcon from '@mui/icons-material/Cancel';
import RemoveIcon from '@mui/icons-material/Remove';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import { IconBack, IconMediaFolder, IconMoreVertical } from '../../../Icons';
import DividerLine from '../../../DividerLine';
import FlexChip from '../../../FlexChip';
import BookmarksDialog from '../Dialogs/BookmarksDialog';
import BrowseLabelsDialog from '../Dialogs/BrowseLabelsDialog';
import { removeOrAppend } from '../../../../functions';
import { config } from '../../../../config';

const rootBreadcrumb = {
	name: '/',
	path: '/',
};

type BreadcrumbConfig = {
	name: string;
	path: string;
};

type IProps = {
	path: string;
	hasEntryLabels: boolean;
	onPathChange: (path: string) => void;
	onLabelsChange: (labels: string[]) => void;
};

export default function Source(props: IProps): React.ReactElement {
	const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbConfig[]>([rootBreadcrumb]);
	const [labels, setLabels] = useState<string[]>([]);
	const [bookmarksDialogOpen, setBookmarksDialogOpen] = useState(false);
	const [browseLabelsDialogOpen, setBrowseLabelsDialogOpen] = useState(false);
	const lastDir = breadcrumbs[breadcrumbs.length - 2];
	const onLabelsChange = (labels: string[]) => {
		labels.sort();
		props.onLabelsChange(labels);
		setLabels(labels);
	};

	useEffect(() => {
		const dirs = props.path.split('/').filter(d => d.trim());
		const breadcrumbs = [rootBreadcrumb];
		const pathBuilder = [];
		
		for (const dir of dirs) {
			pathBuilder.push(dir);
			breadcrumbs.push({
				name: dir,
				path: `/${pathBuilder.join('/')}`,
			});
		}

		setBreadcrumbs(breadcrumbs);
		setLabels([]);
		setBookmarksDialogOpen(false);
		setBrowseLabelsDialogOpen(false);
	}, [props.path]);

	return (
		<Box padding={0.5} sx={{ height: '100%' }}>
			<Typography
				level="body-xs"
				sx={{
					textOverflow: 'ellipsis',
					overflow: 'hidden',
					whiteSpace: 'nowrap',
					direction: 'rtl',
					textAlign: 'center',
				}}
			>
				{props.path}
			</Typography>

			<Stack
				direction="row"
				spacing={1}
			>
				<Dropdown>
					<MenuButton size="md">
						<IconMoreVertical />
					</MenuButton>
					<Menu size="lg" placement="bottom-start">
						{breadcrumbs.map(b =>
							<MenuItem
								key={b.name}
								onClick={() => props.onPathChange(b.path)}
								selected={b.path === props.path}
							>
								{b.name}
							</MenuItem>
						)}
					</Menu>
				</Dropdown>

				<Box flexGrow={1} overflow="hidden">
					{lastDir?.name &&
						<Button
							variant="outlined"
							startDecorator={<IconBack />}
							onClick={() => props.onPathChange(lastDir.path)}
						>
							<Box whiteSpace="nowrap">
								{lastDir.name}
							</Box>
						</Button>
					}
				</Box>

				<ButtonGroup size="md" sx={{ float: 'right' }}>
					{config.showDirs.map(d =>
						<IconButton
							key={d}
							onClick={() => props.onPathChange(d)}
							disabled={d === props.path}
							color="success"
						>
							<IconMediaFolder />
						</IconButton>
					)}
					<IconButton
						onClick={() => setBookmarksDialogOpen(true)}
						color="primary"
					>
						<BookmarksIcon />
					</IconButton>
					<IconButton
						onClick={() => setBrowseLabelsDialogOpen(true)}
						disabled={!props.hasEntryLabels}
						color="primary"
					>
						<LabelIcon />
					</IconButton>
				</ButtonGroup>
			</Stack>
				
			{labels.length > 0 &&
				<Box>
					<DividerLine label="Categories">
						<IconButton
							color="warning"
							size="sm"
							onClick={() => onLabelsChange([])}
						>
							<CancelIcon />
						</IconButton>
					</DividerLine>
					<Stack direction="row" flexWrap="wrap" useFlexGap>
						{labels.map(l =>
							<FlexChip
								key={l}
								withBorder={true}
								startDecorator={<RemoveIcon />}
								size="sm"
								onClick={() => onLabelsChange(removeOrAppend(labels, l))}
							>
								{l}
							</FlexChip>
						)}
					</Stack>
				</Box>
			}

			<BookmarksDialog
				open={bookmarksDialogOpen}
				path={props.path}
				onSelect={props.onPathChange}
				onClose={() => setBookmarksDialogOpen(false)}
			/>

			<BrowseLabelsDialog
				open={browseLabelsDialogOpen}
				path={props.path}
				labels={labels}
				onSelect={onLabelsChange}
				onClose={() => setBrowseLabelsDialogOpen(false)}
			/>
		</Box>
	);
}
