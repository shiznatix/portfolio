import chalk from 'chalk';
import { SkippableError } from '../../errors';
import consts, { Network } from '../../consts';
import type Host from '../../core/host/host';
import { nakedService } from '../../core/service/service-factory';
import { action } from '../../core/service/annotations';
import { getHostNames, getHosts, HostKey } from '../hosts';

export type SshToHostsProps = {
	hosts: HostKey[];
	networks: Network[];
};

const CONF_DIR = '/etc/ssh/ssh_config.d';
const CONF_FILE = 'manage-machines.conf';
const CONF_PATH = `${CONF_DIR}/${CONF_FILE}`;

export default nakedService<SshToHostsProps>()({
	name: 'ssh-to-hosts',
	sudoers: [
		`/usr/bin/rm -f ${CONF_PATH}`,
		`/usr/bin/mv /tmp/${CONF_FILE} ${CONF_PATH}`,
		`/usr/bin/chown root:root ${CONF_PATH}`,
		`/usr/bin/chmod 644 ${CONF_PATH}`,
	],
	debugFiles: [CONF_PATH],
})(Base => class extends Base {
	hostSshKey = null as string | null;
	hostSshDir = `/home/${this.host.username}/.ssh`;
	hosts = getHosts(this.props.hosts);

	async getHostSshKey(noFail = false) {
		if (this.hostSshKey) {
			return this.hostSshKey;
		}

		const { code, stdout } = await this.cmd(`cat ${this.hostSshDir}/id_rsa.pub`, {
			noFail,
		});
		if (code !== 0) {
			return null;
		}
		this.hostSshKey = stdout.trim();
		return this.hostSshKey;
	}

	async addAuthorizedSshKey(destHost: Host) {
		await this.cmd(`ssh-keygen -f '${this.hostSshDir}/known_hosts' -R '${destHost.ip}'`);
		await this.cmd(`ssh-copy-id -o StrictHostKeyChecking=accept-new ${destHost.username}@${destHost.ip}`);
	}

	@(action('install').optional(getHostNames()))
	async install() {
		const hosts = this.hosts.filter(h => this.flagsInclude(h.name));
		const hostsStr = hosts.map(h => h.name).join(', ');
		this.log(`Adding SSH keys for hosts: ${chalk.bold(hostsStr)}`);

		if (hosts.length > 1) {
			const confirm = await this.promptWantingYes('Are you sure you want to run this for so many hosts?');
			if (!confirm) {
				throw new SkippableError('Aborted by user');
			}
		}

		for (const host of hosts) {
			await this.addAuthorizedSshKey(host);
		}
	}

	@action('sync')
	async sync() {
		await this.cmd('rm -f /tmp/ssh-control-*');
		const sshConfigLines = [
			...this.hosts.map(h => `${h.name}.${consts.domains.rh}`),
			...this.props.networks.map(n => n.glob),
		].map(h => [
			`Host ${h}`,
			'    StrictHostKeyChecking accept-new',
			'    UserKnownHostsFile=/dev/null',
			'    LogLevel ERROR',
			'    ControlMaster auto',
			`    ControlPath /tmp/ssh-control-%C`,
			'    ControlPersist 10m',
			'    StreamLocalBindUnlink yes',
			'    ServerAliveInterval 30',
			'    ServerAliveCountMax 3',
			'',
		])
		.flat()
		.join('\n');

		await this.cmd(`sudo rm -f ${CONF_PATH}`, { noFail: true });
		await this.write(CONF_PATH, sshConfigLines, {
			owner: 'root',
			permissions: '644',
		});
	}
});
