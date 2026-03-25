import { CmdOpts } from '../../core/host/types';
import { action } from '../../core/service/annotations';
import { sysdService } from '../../core/service/service-factory';
import { prettyJson } from '../../utils';

const INSTALL_SCRIPT = `https://get.docker.com`;
const DAEMON_CONFIG = prettyJson({
	'log-driver': 'json-file',
	'log-opts': {
		'max-size': '10m',
		'max-file': '3',
	},
});

export default sysdService()({
	name: 'docker',
})(Base => class extends Base {
	@(action('install').filter('build'))
	async install() {
		const { code } = await this.cmd('which docker', {
			noFail: true,
			silent: true,
		});
		if (code !== 0 || this.flagsIncludeExplicit('build')) {
			await this.cmd(`curl -sSL ${INSTALL_SCRIPT} | sh`);
		}

		await this.cmd('sudo usermod -aG docker $USER');
	}

	@action('sync')
	async sync() {
		await this.write('/etc/docker/daemon.json', DAEMON_CONFIG, { owner: 'root' });
	}

	@action('uninstall')
	async uninstall() {
		const opts: CmdOpts = { noFail: true };
		await this.cmd('sudo apt purge docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras -y', opts);
		await this.cmd('sudo rm -rf /var/lib/docker', opts);
		await this.cmd('sudo rm -rf /var/lib/containerd', opts);
		await this.cmd('sudo rm /etc/apt/sources.list.d/docker.sources', opts);
		await this.cmd('sudo rm /etc/apt/keyrings/docker.asc', opts);
	}
});
