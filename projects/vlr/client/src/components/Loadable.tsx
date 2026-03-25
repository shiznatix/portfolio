import React from 'react';
import { Box, CircularProgress } from '@mui/joy';

type IProps = {
	loading: boolean;
	children: JSX.Element | JSX.Element[];
};

export default function Loadable(props: IProps): React.ReactElement {
	return (
		<Box sx={{ height: '100%' }}>
			<Box sx={{
				display: props.loading ? 'none' : '',
				height: '100%',
			}}>
				{props.children}
			</Box>
			<Box sx={{
				height: '100%',
				width: '100%',
				display: props.loading ? 'flex' : 'none',
				alignItems: 'center',
				justifyContent: 'center',
			}}>
				<CircularProgress />
			</Box>
		</Box>
	);
}
