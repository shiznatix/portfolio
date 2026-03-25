import { action } from '../../core/service/annotations';
import { dockerService } from '../../core/service/service-factory';

export default dockerService()({
	name: 'satisfactory-server',
	installSubDirs: ['config'],
	rsyncUpExcludes: ['config'],
})(Base => class extends Base {
	@action('backup')
	async backup() {
		await this.rsyncDown({
			remoteSubPath: 'config/',
			localSubPath: 'config',
			excludes: [
				'gamefiles',
			],
		});
	}
});
