import React from 'react';

import MJpegStream from './streams/MJpegStream';
import RtcPeerStream from './streams/RtcPeerStream';

const CameraStream: React.FC = () => {
	return (
		<>
			<RtcPeerStream />
			<MJpegStream />
		</>
	);
};

export default CameraStream;
