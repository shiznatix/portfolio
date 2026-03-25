import React, { useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Autocomplete, IconButton } from '@mui/joy';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardHideIcon from '@mui/icons-material/KeyboardHide';
import { arrayUnique } from '../functions';

type IPropsSearchInput = {
	fileNames: string[];
	size?: 'sm' | 'md' | 'lg';
	onChange: (str: string) => void;
	onFocusChange: (focused: boolean) => void;
};

export default function SearchInput(props: IPropsSearchInput): React.ReactElement {
	const [focused, setFocused] = useState(false);
	const [value, setValue] = useState('');
	const searchRef = useRef<HTMLInputElement | null>(null);
	const debounceValueChange = useDebouncedCallback((newValue: string) => {
		props.onChange(newValue.toLowerCase());
	}, 500);
	const size = props.size || 'sm';
	const onInputChange = (newValue: string) => {
		setValue(newValue);
		debounceValueChange(newValue);
	};
	const options = useMemo(() => {
		return arrayUnique([
			value,
			...props.fileNames,
		].map(v => v.trim()).filter(v => v));
	}, [value, props.fileNames]);
	const onFocusChange = (focused: boolean) => {
		if (!focused) {
			searchRef.current?.blur();
		}

		setFocused(focused);
		props.onFocusChange(focused);
	};

	return (
		<Autocomplete
			size={size}
			placeholder={focused ? 'Search' : ''}
			startDecorator={<SearchIcon />}
			endDecorator={focused &&
				<IconButton onClick={() => onFocusChange(false)}>
					<KeyboardHideIcon />
				</IconButton>
			}
			value={value}
			open={focused && value !== ''}
			disableClearable={!focused}
			freeSolo={true}
			selectOnFocus={true}
			blurOnSelect={true}
			options={options}
			onInputChange={(_, value) => onInputChange(value)}
			onFocus={() => onFocusChange(true)}
			onBlur={() => onFocusChange(false)}
			slotProps={{
				input: {
					ref: searchRef,
				},
			}}
		/>
	);
}