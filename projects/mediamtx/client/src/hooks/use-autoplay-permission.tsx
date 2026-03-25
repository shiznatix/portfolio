import { useCallback, useState } from 'react';

let autoplayPermissionRequested = false;

const requestAutoplayPermission = async () => {
	if (autoplayPermissionRequested) {
		return;
	}
	autoplayPermissionRequested = true;
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await (navigator.permissions as any).request({ name: 'autoplay' });
	} catch {
		// Not supported or denied — user will use the play control
	}
};

export const useAutoplayPermission = () => {
	const [showControls, setShowControls] = useState(false);

	const handleAutoplayBlocked = useCallback(() => {
		requestAutoplayPermission();
		setShowControls(true);
	}, []);

	return { showControls, handleAutoplayBlocked };
};
