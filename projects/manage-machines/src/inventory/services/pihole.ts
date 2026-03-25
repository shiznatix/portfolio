import consts from '../../consts';
import { action } from '../../core/service/annotations';
import { dockerService } from '../../core/service/service-factory';
import { getHosts } from '../hosts';
import secrets from '../../../secrets.json';

export type PiHoleProps = {
	password?: string;
	ports?: {
		http?: number;
		prometheus?: number;
	};
};

export default dockerService<PiHoleProps>()({
	name: 'pihole',
	installSubDirs: [
		'config',
		'config/etc-pihole',
		'config/etc-dnsmasq.d',
	],
	sudoers: [
		`/usr/bin/sed * /etc/systemd/resolved.conf`,
		'/usr/bin/rm -f /etc/resolv.conf',
		'/usr/bin/ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf',
		'/usr/bin/systemctl restart systemd-resolved',
	],
	aptDependencies: [
		'systemd-resolved',
	],
	rsyncUpExcludes: [
		'config',
	],
	props: {
		password: secrets.pihole.webPassword,
	},
	ports: {
		http: 7000,
		prometheus: 9617,
	},
})(Base => class extends Base {
	configEnv = {
		PASSWORD: this.props.password!,
		LOCAL_IPV4: this.host.ip,
		LOCAL_DOMAIN: consts.domains.rh,
	};

	@action('install')
	async install() {
		// https://github.com/pi-hole/docker-pi-hole#installing-on-ubuntu-or-fedora
		await this.cmd(`sudo sed -r -i.orig 's/#?DNSStubListener=yes/DNSStubListener=no/g' /etc/systemd/resolved.conf`);
		await this.cmd('sudo rm -f /etc/resolv.conf');
		await this.cmd('sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf');
		await this.cmd('sudo systemctl restart systemd-resolved');
	}

	@action('sync')
	async sync() {
		const hostRecords = getHosts()
			.flatMap(h => h.dns.map(d => `        ${d.ip} ${d.name}.${consts.domains.rh}`))
			.join('\n');

		await this.write('host-records.conf', hostRecords);
		await this.cmd(`sed -i '/{{HOST_RECORDS}}/{{r ${this.workDir}/host-records.conf\nd}}' ${this.workDir}/docker-compose.yml`);
	}

	@action('backup')
	async backup() {
		await this.rsyncDown({
			localSubPath: 'config',
			remoteSubPath: 'config',
			excludes: [
				'etc-pihole/logrotate',
			],
		});
	}
});
