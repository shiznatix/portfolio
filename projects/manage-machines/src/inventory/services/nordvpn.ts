import chalk from 'chalk';
import { nakedService } from '../../core/service/service-factory';
import { action, hook } from '../../core/service/annotations';
import { Network } from '../../consts';

export type NordVpnProps = {
	whitelistNetworks: Network[];
	whitelistPorts?: number[];
	accessToken: string;
	autoConnect?: boolean;
	killSwitch?: boolean;
};

const INSTALL_SCRIPT = `https://downloads.nordcdn.com/apps/linux/install.sh`;

export default nakedService<NordVpnProps>()({
	name: 'nordvpn',
})(Base => class extends Base {
	@(action('install').optional('build'))
	async install() {
		const { code } = await this.cmd('which nordvpn', {
			noFail: true,
			silent: true,
		});
		if (code !== 0 || this.flagsIncludeExplicit('build')) {
			await this.cmd(`sh <(curl -sSf ${INSTALL_SCRIPT})`);
		}

		await this.cmd('sudo usermod -aG nordvpn $USER');
	}

	@action('sync')
	async sync() {
		// always whitelist port `22` for SSH and `5900` for VNC
		const whitelistPorts = [...(this.props.whitelistPorts || []), 22, 5900];
		for (const port of whitelistPorts) {
			await this.cmd(`nordvpn whitelist add port ${port}`, {
				noFail: true,
			});
		}

		for (const network of this.props.whitelistNetworks) {
			await this.cmd(`nordvpn whitelist add subnet ${network.mask}`, {
				noFail: true,
			});
		}
		await this.cmd('nordvpn set analytics off');
	}

	@action('status')
	async status() {
		const account = await this.cmd('nordvpn account', {
			noFail: true,
			silent: true,
		});
		this.log(`${account.stdout.trim()}\n`);

		const status = await this.cmd('nordvpn status', {
			silent: true,
		});
		this.log(`${status.stdout.trim()}\n`);

		const match = status.stdout.match(/Status: ([A-Za-z]+)/);
		this.log(chalk.bold(match ? match[1].trim() : 'unknown'));
	}

	@action('start')
	@hook('install.sync.end')
	async start() {
		await this.cmd(`nordvpn login --token ${this.props.accessToken}`, {
			noFail: true,
		});
		await this.cmd('nordvpn connect');
		await this.cmd(`nordvpn set autoconnect ${this.props.autoConnect ? 'on' : 'off'}`);
		await this.cmd(`nordvpn set killswitch ${this.props.killSwitch ? 'on' : 'off'}`);
	}

	@action('stop')
	@hook('uninstall.begin')
	async stop() {
		await this.cmd('nordvpn disconnect', {
			noFail: true,
		});
		await this.cmd('nordvpn logout --persist-token', {
			noFail: true,
		});
	}

	@action('restart')
	async restart() {
		await this.stop();
		await this.start();
	}

	@action('uninstall')
	async uninstall() {
		await this.cmd(`sudo apt-get --purge -y remove 'nordvpn*'`);
	}
});
