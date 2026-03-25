import React from 'react';
import { Button, ButtonGroup, IconButton, Stack } from '@mui/joy';
import FilterButton from '../../../FilterButton';
import { EpisodesMutators, FilterGroupValue } from '../../../../types';
import { IconDownloaded, IconRandom, IconSeen, IconStarred, IconUnseen } from '../../../Icons';

type EpisodesFilters = {
	seen: FilterGroupValue;
	autoDownloaded: FilterGroupValue;
	includeInRandom: FilterGroupValue;
	starred: FilterGroupValue;
};

type IProps = {
	mutators: EpisodesMutators;
	onChange: (filters: Partial<EpisodesMutators>) => void;
};

function xattrsMatch(a: EpisodesFilters, b: EpisodesFilters) {
	return a.seen === b.seen
		&& a.autoDownloaded === b.autoDownloaded
		&& a.includeInRandom === b.includeInRandom
		&& a.starred === b.starred;
}

export default function Filters(props: IProps): React.ReactElement {
	const xattrNewDownloaded: EpisodesFilters = {
		seen: 'no',
		autoDownloaded: 'yes',
		includeInRandom: 'no',
		starred: 'both',
	};
	const xattrUnseen: EpisodesFilters = {
		seen: 'no',
		autoDownloaded: 'both',
		includeInRandom: 'both',
		starred: 'both',
	};
	const xattrAll: EpisodesFilters = {
		seen: 'both',
		autoDownloaded: 'both',
		includeInRandom: 'both',
		starred: 'both',
	};
	const filters: EpisodesFilters = {
		seen: props.mutators.seen,
		autoDownloaded: props.mutators.autoDownloaded,
		includeInRandom: props.mutators.includeInRandom,
		starred: props.mutators.starred,
	};

	return (
		<Stack
			direction="row"
			spacing={1}
		>
			<Stack
				direction="row"
				spacing={1}
				sx={{ flexGrow: 1 }}
			>
				<FilterButton
					size="md"
					badgeInset="-10%"
					value={filters.autoDownloaded}
					onChange={autoDownloaded => props.onChange({ autoDownloaded })}
				>
					<IconDownloaded />
				</FilterButton>

				<FilterButton
					size="md"
					badgeInset="-10%"
					value={filters.includeInRandom}
					onChange={includeInRandom => props.onChange({ includeInRandom })}
				>
					<IconRandom />
				</FilterButton>

				<FilterButton
					size="md"
					badgeInset="-10%"
					value={filters.starred}
					onChange={starred => props.onChange({ starred })}
				>
					<IconStarred />
				</FilterButton>

				<FilterButton
					size="md"
					badgeInset="-10%"
					value={filters.seen}
					onChange={seen => props.onChange({ seen })}
				>
					<IconSeen />
				</FilterButton>
			</Stack>

			<ButtonGroup size="md">
				<Button
					color="success"
					variant={xattrsMatch(filters, xattrAll) ? 'soft' : 'outlined'}
					onClick={() => props.onChange(xattrAll)}
				>
					All
				</Button>
				<IconButton
					color="success"
					variant={xattrsMatch(filters, xattrUnseen) ? 'soft' : 'outlined'}
					onClick={() => props.onChange(xattrUnseen)}
				>
					<IconUnseen />
				</IconButton>
				<IconButton
					color="success"
					variant={xattrsMatch(filters, xattrNewDownloaded) ? 'soft' : 'outlined'}
					onClick={() => props.onChange(xattrNewDownloaded)}
				>
					<IconDownloaded />
				</IconButton>
			</ButtonGroup>
		</Stack>
	);
}
