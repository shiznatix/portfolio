import React from 'react';
import { Grid, Button, Drawer, Sheet } from '@mui/joy';
import { useNavState, useViewState } from '../state';
import { ViewKey } from '../types';

type IProps = {
	onClick: (viewKey: ViewKey) => void;
};

type IPropsNavButton = IProps & {
	viewKey: ViewKey;
};

function NavButton(props: IPropsNavButton) {
	const { viewKey, viewMeta } = useViewState(state => ({
		viewKey: state.viewKey,
		viewMeta: state.getViewMeta(props.viewKey),
	}));
	// outlined plain soft solid
	const variant = viewKey == props.viewKey ? 'solid' : 'outlined';

	return (
		<Button
			startDecorator={viewMeta.icon}
			variant={variant}
			onClick={() => props.onClick(props.viewKey)}
			sx={{ height: '100%', width: '100%' }}
		>
			{viewMeta.title}
		</Button>
	);
}

export default function Navigation(props: IProps): React.ReactElement {
	const navState = useNavState();

	return (
		<Drawer
			anchor="bottom"
			size="sm"
			variant="plain"
			open={navState.open}
			onClose={() => navState.setOpen(false)}
			slotProps={{
				content: {
					sx: {
						background: 'transparent',
						boxShadow: 'none',
					},
				},
			}}
		>
			<Sheet
				variant="outlined"
				onClick={() => navState.setOpen(false)}
				sx={{
					maxWidth: '500px',
					margin: 'auto',
					height: '100%',
					width: '100%',
				}}
			>
				<Grid container sx={{ height: '100%' }}>
					<Grid xs={6}>
						<NavButton
							{...props}
							viewKey="status"
						/>
					</Grid>
					<Grid xs={6}>
						<NavButton
							{...props}
							viewKey="downloads"
						/>
					</Grid>
					<Grid xs={6}>
						<NavButton
							{...props}
							viewKey="fsEpisodes"
						/>
					</Grid>
					<Grid xs={6}>
						<NavButton
							{...props}
							viewKey="browse"
						/>
					</Grid>
					<Grid xs={12}>
						<NavButton
							{...props}
							viewKey="random"
						/>
					</Grid>
				</Grid>
			</Sheet>
		</Drawer>
	);
}
