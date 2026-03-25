import React, { useState } from 'react';
import { Stack } from '@mui/joy';
import SearchInput from './SearchInput';

type IProps = {
	searchOptions: string[];
	size?: 'sm' | 'md' | 'lg';
	onSearchChange: (search: string) => void;
	children?: React.ReactNode;
};

export default function SearchBar(props: IProps): React.ReactElement {
	const [searchFocused, setSearchFocused] = useState(false);

	return (
		<Stack direction="row" spacing={1} sx={{ paddingX: 1 }}>
			{props.children &&
				<Stack
					direction="row"
					spacing={1}
					sx={{
						display: searchFocused ? 'none' : 'flex',
					}}
				>
					{props.children}
				</Stack>
			}
			<SearchInput
				size={props.size}
				fileNames={props.searchOptions}
				onChange={props.onSearchChange}
				onFocusChange={setSearchFocused}
			/>
		</Stack>
	);
}
