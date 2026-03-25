import { HostIpAndPort } from '../../core/host/host-refs';
import { action, hook } from '../../core/service/annotations';
import { sysdService } from '../../core/service/service-factory';
import { hub } from '../hosts/hub/local';

export type AlloyProps = {
	loki?: HostIpAndPort | string;
	systemd?: boolean;
	extraSystemdServices?: string[];
	docker?: boolean;
};
// const DEFAULT_SYSTEMD_SERVICES = [
// 	'crazy-clock',
// 	'ir-remote',
// 	'rh-assistant',
// 	'rh-hub',
// 	'rh-event-devices',
// 	'rh-sensors',
// 	'rh-servos',
// 	'rh-image-detector',
// 	'rh-alive',
// 	// 'mediamtx',
// 	'transmission-vpn',
// 	'vlr-search',
// 	'vlr',
// ] as const;

export default sysdService<AlloyProps>()({
	name: 'alloy',
	configJson: true,
	unitInstallable: false,
	aptDependencies: [
		'gpg',
	],
	sudoers: [
		`/usr/bin/mkdir -p mkdir -p /etc/apt/keyrings/`,
		'/usr/bin/tee /etc/apt/keyrings/grafana.gpg',
		'/usr/bin/tee /etc/apt/sources.list.d/grafana.list',
		'/usr/bin/rm -f /etc/apt/sources.list.d/grafana.list',
		'/usr/sbin/usermod -a -G systemd-journal alloy',
		'/usr/sbin/usermod -a -G docker alloy',
	],
	props: {
		loki: hub.ipAndPort('grafana', 'loki'),
		systemd: true,
	},
})
(Base => class extends Base {
	@action('install')
	async install() {
		await this.cmd('sudo mkdir -p /etc/apt/keyrings/');
		await this.cmd('wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null');
		await this.cmd('echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list');
		await this.aptInstall([
			'alloy',
		], { forceUpdate: true });
	}

	@action('uninstall')
	async uninstall() {
		await this.cmd('sudo apt remove --purge alloy -y');
		await this.cmd('sudo rm -f /etc/apt/sources.list.d/grafana.list');
		// await this.cmd('sudo rm -f /etc/apt/keyrings/grafana.gpg');
	}

	@hook('install.sync.begin')
	async setUsers() {
		if (this.props.systemd) {
			await this.cmd('sudo usermod -a -G systemd-journal alloy');
		}
		if (this.props.docker) {
			await this.cmd('sudo usermod -a -G docker alloy');
		}
	}

	@hook('install.end')
	async enable() {
		await this.sysdEnable();
		await this.sysdRestart({ force: true });
	}
});
