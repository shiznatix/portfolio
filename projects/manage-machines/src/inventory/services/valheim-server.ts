import { action } from '../../core/service/annotations';
import { dockerService } from '../../core/service/service-factory';

export default dockerService()({
	name: 'valheim-server',
	installSubDirs: ['config'],
	rsyncUpExcludes: ['config', 'data'],
})(Base => class extends Base {
	@action('backup')
	async backup() {
		await this.rsyncDown({
			remoteSubPath: 'config/backups/',
		});
	}
});
