import React from 'react';
import { Dropdown, ListItemDecorator, Menu, MenuButton, MenuItem } from '@mui/joy';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import { BrowseFilter } from '../../../../types';

type IProps = {
	selectedFilters: BrowseFilter[];
	onClick: (filter: BrowseFilter) => void;
};

type IPropsMenuItem = IProps & {
	filter: BrowseFilter;
	label: string;
};

function FilterItem(props: IPropsMenuItem) {
	const selected = props.selectedFilters.includes(props.filter);
	const decorator = selected ? <CheckCircleIcon /> : <UnpublishedIcon />;

	return (
		<MenuItem
			selected={selected}
			onClick={() => props.onClick(props.filter)}
		>
			<ListItemDecorator>
				{decorator}
			</ListItemDecorator>
			{props.label}
		</MenuItem>
	);
}

export default function Filters(props: IProps): React.ReactElement {
	return (
		<Dropdown>
			<MenuButton
				size="sm"
				startDecorator={<FilterListIcon />}
			>
				{props.selectedFilters.length}
			</MenuButton>
			<Menu placement="bottom-start">
				<FilterItem {...props} filter="seen" label="Seen" />
				<FilterItem {...props} filter="auto-downloaded" label="Auto Downloaded" />
			</Menu>
		</Dropdown>
	);
}
