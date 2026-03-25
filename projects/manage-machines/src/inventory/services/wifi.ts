import { action } from '../../core/service/annotations';
import { nakedService } from '../../core/service/service-factory';
import secrets from '../../../secrets.json';
import { SkippableError } from '../../errors';

type WifiNetwork = {
	ssid: string;
	password: string;
	autoConnect?: boolean; // default: true
};

export type WifiProps = {
	default?: WifiNetwork;
	extra?: WifiNetwork[];
};

export const defaultWifiProps = {
	default: secrets.wifi.homeWifi,
	extra: [
		secrets.wifi.funOnABun,
		secrets.wifi.cheezynet,
	],
} as const satisfies WifiProps;

export default nakedService<WifiProps>()({
	name: 'wifi',
	props: defaultWifiProps,
})(Base => class extends Base {
	networks: WifiNetwork[] = [
		this.props.default!,
		...(this.props.extra || []),
	];

	ssids = this.networks.map(n => n.ssid);

	@action('install')
	async install() {
		for (const network of this.networks) {
			const exists = await this.cmd(`sudo nmcli -t connection show "${network.ssid}"`, {
				noFail: true,
				silent: true,
			});

			if (exists.code !== 0) {
				await this.cmd(`sudo nmcli connection add type wifi con-name "${network.ssid}" ifname wlan0 ssid "${network.ssid}"`);
				await this.cmd(`sudo nmcli connection modify "${network.ssid}" wifi-sec.key-mgmt wpa-psk`);
			}

			await this.cmd(`sudo nmcli connection modify "${network.ssid}" 802-11-wireless.ssid "${network.ssid}"`);
			await this.cmd(`sudo nmcli connection modify "${network.ssid}" wifi-sec.psk "${network.password}"`);
			const autoConnect = network.autoConnect !== false ? 'yes' : 'no';
			await this.cmd(`sudo nmcli connection modify "${network.ssid}" connection.autoconnect ${autoConnect}`);
		}

		// await this.triggerAction('start');
		await this.triggerAction('uninstall');
	}

	@(action('start').optional(t => t.ssids))
	async start() {
		const ssids = this.flags.include.length > 0
			? this.flags.include.filter(s => this.ssids.includes(s))
			: [this.props.default!.ssid];

		if (!ssids.length) {
			throw Error('WiFi network not found');
		}

		for (const ssid of ssids) {
			await this.cmd(`sudo nmcli connection up "${ssid}"`, {
				noFail: true,
				timeoutSec: 1,
			});
		}
	}

	@action('status')
	async status() {
		await this.cmd('nmcli -t -f ACTIVE,SSID dev wifi | grep "yes"', {
			noFail: true,
		});
		await this.cmd('nmcli -t -f NAME,DEVICE,TYPE,STATE connection show --active', {
			noFail: true,
		});
	}

	@action('uninstall')
	async uninstall() {
		const networks = this.networks;
		const allConnsRes = await this.cmd('nmcli --colors no -t -f DEVICE,NAME connection show', {
			noFail: true,
			silent: true,
		});
		const origList = (allConnsRes.stdout || '').split('\n')
			.map(s => s.trim())
			.filter(s => s && s.startsWith('wlan0:') || (s.startsWith(':') && !s.toLowerCase().includes('wired')))
			.map(s => s.split(':').pop()?.trim())
			.filter(s => s);
		const removeList = origList.filter(name => !networks.find(c => c.ssid === name));

		if (!removeList.length) {
			this.log.warn('No WiFi networks to remove');
			return;
		}

		this.log(`Configured WiFi networks:`);
		for (const network of origList) {
			const symbol = removeList.includes(network) ? '❌' : '✅';
			this.log(` ${symbol} ${network}`);
		}

		const userConfirmedDel = await this.promptWantingNo(`This will remove ${removeList.length} WiFi networks. Are you sure?`);
		if (!userConfirmedDel) {
			throw new SkippableError('Failed getting user confirmation');
		}

		this.log(`Removing WiFi networks: ${removeList.join(', ')}`);

		for (const network of removeList) {
			await this.cmd(`sudo nmcli connection delete "${network}"`, {
				noFail: true,
			});
		}
	}
});
