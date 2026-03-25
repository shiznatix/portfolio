import { sysdTimerService } from '../../core/service/service-factory';
import { HostName } from '../hosts';

export type RhAliveProps = {
	hostNames?: HostName[];
	mediamtxPaths?: string[];
	allDownThreshold?: number;
	allDownAction?: 'reboot';
};

export default sysdTimerService<RhAliveProps>()({
	name: 'rh-alive',
})(Base => class extends Base {
	unitTimerOnBootSec = 60;
	unitTimerOnUnitActiveSec = 60;
	unitExecStart = '{{INSTALL_PATH}}/check.sh';
	unitEnvironment = {
		HOSTS: this.props.hostNames?.join(' ') || '',
		MEDIAMTX_PATHS: this.props.mediamtxPaths?.join(' ') || '',
		ALL_DOWN_THRESHOLD: this.props.allDownThreshold?.toString() || '',
		ALL_DOWN_ACTION: this.props.allDownAction || '',
	};
});
