import { withMixin } from '../mixin-factory';

const host = withMixin('host')
(Base => class extends Base {
	async os() {
		const res = await this.cmd('cat /etc/os-release');
		const name = res.stdout.match(/NAME="([a-z/A-Z ]{3,20})"/g)?.pop() || '' as string;
		const version = res.stdout.match(/VERSION_CODENAME=([a-zA-Z]{3,20})/g)?.pop() || '' as string;

		return {
			name: name.replace('NAME=', '').replaceAll('"', '').trim(),
			version: version.replace('VERSION_CODENAME=', '').trim(),
		};
	}

	async arch() {
		const res = await this.cmd('uname -m');
		return res.stdout.trim();
	}

	async hostRestart() {
		await this.cmd('sudo shutdown --reboot 0 && exit');
	}
});

export default host;
