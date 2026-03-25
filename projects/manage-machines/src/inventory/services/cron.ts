import { action, hook } from '../../core/service/annotations';
import { nakedService } from '../../core/service/service-factory';

export type CronProps = {
	lines: string[];
};

export default nakedService<CronProps>()({
	name: 'cron',
})(Base => class extends Base {
	@action('install')
	async install() {
		for (const line of this.props.lines) {
			await this.cmd(`(crontab -l; echo "${line}") | crontab -`);
		}
	}

	@action('status')
	async status() {
		await this.cmd('crontab -l');
	}

	@action('uninstall')
	@hook('install.begin')
	async uninstall() {
		await this.cmd('crontab -r', {
			noFail: true,
		});
	}
});
