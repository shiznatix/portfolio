import { SkippableError } from '../../errors';
import { nakedService } from '../../core/service/service-factory';
import { action, hook } from '../../core/service/annotations';
import { APT_UPDATE_TS_FILE } from '../../core/service/common/apt';

export type SystemProps = {
	files?: {
		owner?: string;
		permissions?: string | number;
		path: string;
		contents: string;
	}[];
	additionalSudoers?: string[];
	additionalPackages?: string[];
};

export default nakedService<SystemProps>()({
	name: 'system',
})
(Base => class extends Base {
	sudoers = [
		'/usr/bin/apt *',
		'/usr/bin/systemctl *',
		'/usr/bin/snap refresh',
		'/usr/bin/netstat -tulpn',
		'/usr/bin/rm /var/lib/apt/lists/*_*',
		`/usr/bin/touch ${APT_UPDATE_TS_FILE}`,
		'/usr/sbin/shutdown --reboot 0',
		`/usr/bin/mkdir -p /var/lib/*`,
		`/usr/bin/chown * /var/lib/*`,
		`/usr/bin/rm -rf /var/lib/*`,
		`/usr/bin/ln -s /var/lib/* /lib/systemd/system/*`,
		`/usr/bin/ln -s /var/lib/* /usr/lib/systemd/system/*`,
		`/usr/bin/ln -s /var/lib/* /etc/systemd/system/*`,
		`/usr/bin/rm -f /lib/systemd/system/*`,
		`/usr/bin/rm -f /usr/lib/systemd/system/*`,
		`/usr/bin/rm -f /etc/systemd/system/*`,
		`/usr/bin/mkdir -p /etc/apt/keyrings/`,
		`/usr/bin/ln -s /home/${this.host.username}/.local/bin/uv /usr/local/bin/`,
		...(this.props.additionalSudoers || []),
	];

	@(action('install').optional(['apt', 'files']).flag('reboot'))
	async install() {
		if (this.flagsInclude('apt')) {
			await this.cmd('sudo rm /var/lib/apt/lists/*_*', {
				noFail: true,
			});
			await this.aptInstall([
				'unattended-upgrades',
				'git',
				'bash-completion',
				'net-tools',
				'python3-dev',
				...(this.props.additionalPackages || []),
			], { forceUpdate: true });
			await this.aptUpgrade();
		}
	}

	@hook('install.final', t => t.flags.reboot)
	async rebootAfterInstall() {
		await this.hostRestart();
	}

	@(action('sync', t => t.props.files).optional('files'))
	async sync() {
		for (const file of this.props.files!) {
			await this.write(file.path, file.contents, {
				owner: file.owner,
				permissions: file.permissions,
			});
		}
	}

	@(action('deps').flag('reboot'))
	async deps() {
		await this.aptUpgrade();

		if (this.flags.reboot) {
			await this.restart();
		}
	}

	@action('restart')
	async restart() {
		await this.hostRestart();
	}

	@action('stop')
	async stop() {
		await this.cmd('sudo shutdown now');
	}

	@action('test')
	async test() {
		const { code } = await this.cmd('exit', {
			timeoutSec: 3,
			noFail: true,
		});

		if (code !== 0) {
			throw new SkippableError('Host is not up');
		}

		const os = await this.os();
		const arch = await this.arch();
		const { stdout: uptimeOut } = await this.cmd('uptime');
		const uptime = (uptimeOut.match(/up (.+?),/)?.[1] || 'unknown').trim();

		await this.cmd('sudo netstat -tulpn | grep LISTEN', {
			noFail: true,
		});
		await this.cmd('journalctl --disk-usage', {
			noFail: true,
		});
		await this.cmd('df -h', {
			noFail: true,
		});

		console.table({
			[this.host.name]: {
				os: os.version,
				arch,
				uptime,
			},
		});
	}

	@action('status')
	async status() {
		const { stdout: uptimeOut } = await this.cmd('uptime', {
			timeoutSec: 5,
		});
		const uptime = (uptimeOut.match(/up (.+?),/)?.[1] || 'unknown').trim();
		this.log(`Uptime for ${this.host.name}: ${uptime}`);
	}
});
