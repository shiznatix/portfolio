import { action } from '../../core/service/annotations';
import { nakedService } from '../../core/service/service-factory';

export default nakedService()({
	name: 'nfs-client',
	aptDependencies: ['nfs-common'],
})(Base => class extends Base {
	@action('uninstall')
	async uninstall() {
		await this.cmd('sudo apt remove --purge nfs-common -y');
	}
});
