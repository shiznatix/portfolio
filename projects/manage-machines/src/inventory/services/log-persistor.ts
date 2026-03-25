import { sysdTimerService } from '../../core/service/service-factory';

export type LogPersistorProps = {
	services: string[];
};

export default sysdTimerService<LogPersistorProps>()({
	name: 'log-persistor',
	rsyncUpExcludes: [
		'logs',
	],
})(Base => class extends Base {
	unitTimerOnBootSec = 1;
	unitTimerOnUnitActiveSec = 60;
	unitExecStart = '{{INSTALL_PATH}}/collect.sh';
	unitEnvironment = {
		SERVICES: this.props.services.join(' '),
		LOG_DIR: '{{INSTALL_PATH}}/logs',
		RETENTION_HOURS: '12',
	};
});
