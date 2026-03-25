import React, { useContext, useEffect, useState } from 'react';
import { Typography } from '@mui/joy';
import Dialog from '../../Dialog';
import { ApiContext } from '../../../context';
import * as api from '../../../api';
import { VlrStatus } from '../../../types';

interface IProps {
	open: boolean;
	onClose: () => void;
}

export default function StatusDialog(props: IProps): React.ReactElement {
	const apiCall = useContext(ApiContext);
	const [status, setStatus] = useState<VlrStatus>();

	useEffect(() => {
		if (props.open) {
			apiCall(async () => {
				setStatus(await api.status());
			});
		}
	}, [props.open]);

	return (
		<Dialog.Dialog
			open={props.open}
			title="System Status"
			cancelLabel="Close"
			onCancel={props.onClose}
		>	
			<Typography
				level="body-xs"
				component="pre"
				sx={{
					whiteSpace: 'pre-wrap',
				}}
			>
				{JSON.stringify(status, null, 2)}
			</Typography>
		</Dialog.Dialog>
	);
}
