import React from 'react';
import { Box, List, ListDivider, ListItem, ListItemContent, Typography } from '@mui/joy';
import Dialog from '../../../Dialog';

type IProps = {
	open: boolean;
	logs: string[];
	onClose: () => void;
};

export default function LogsDialog(props: IProps): React.ReactElement {
	return (
		<Dialog.Dialog
			open={props.open}
			title="Logs"
			onCancel={props.onClose}
		>
			<List>
				{props.logs.map((l, i) =>
					<Box key={i}>
						<ListItem>
							<ListItemContent>
								<Typography level="body-md" sx={{ overflowWrap: 'break-word' }}>
									{l}
								</Typography>
							</ListItemContent>
						</ListItem>
						<ListDivider />
					</Box>
				)}
			</List>
		</Dialog.Dialog>
	);
}
