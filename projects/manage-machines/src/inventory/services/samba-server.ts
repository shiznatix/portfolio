import { Network } from '../../consts';
import { action } from '../../core/service/annotations';
import { nakedService } from '../../core/service/service-factory';

export type SambaServerProps = {
	password: string;
	oldSecurity?: boolean;
	shares: {
		name: string;
		dir: string;
		networks: Network[];
		writable?: boolean;
		browseable?: boolean;
		public?: boolean;
	}[];
};

const CONF_TEMPLATE = `
[global]
   log level = 2
   log file = /dev/null
   logging = systemd
   server role = standalone server
   map to guest = bad user
   obey pam restrictions = no
   unix password sync = no
   pam password change = no
   # panic action = /usr/share/samba/panic-action %d
   passwd chat = *Enter\\snew\\s*\\spassword:* %n\\n *Retype\\snew\\s*\\spassword:* %n\\n *password\\supdated\\ssuccessfully* .
   passwd program = /usr/bin/passwd %u
   idmap config * : backend = tdb
   security = user
   server min protocol = {{SECURITY_PROTOCOL}}
   client min protocol = {{SECURITY_PROTOCOL}}
   ntlm auth = {{NTLM_AUTH}}
[homes]
   browseable = no
   writable = no
   guest ok = no
   valid users = nobody
`;
const SHARE_TEMPLATE = `
[{{SHARE_NAME}}]
   path = {{SHARE_DIR}}
   valid users = {{VALID_USERS}}
   writable = {{WRITABLE}}
   browseable = {{BROWSEABLE}}
   public = {{PUBLIC}}
   hosts allow = {{HOSTS_ALLOW}}
   hosts deny = 0.0.0.0/0
`;

export default nakedService<SambaServerProps>()({
	name: 'samba-server',
	// unitName = 'smbd';
	aptDependencies: [
		'samba',
		'samba-common-bin',
	],
	aptDepencenciesFlags: {
		reinstall: true,
	},
	debugFiles: [
		'/etc/samba/smb.conf',
	],
	sudoers: [
		'/usr/bin/smbstatus',
		'/usr/bin/smbpasswd *',
	],
	// journalOpts: {
	// 	postCommand: 'grep -v "\\.\\./\\.\\./"',
	// },
})(Base => class extends Base {
	get configContents() {
		const conf = [CONF_TEMPLATE
			.replaceAll('{{SECURITY_PROTOCOL}}', this.props.oldSecurity ? 'NT1' : 'SMB2')
			.replaceAll('{{NTLM_AUTH}}', this.props.oldSecurity ? 'yes' : 'no'),
		];

		for (const share of this.props.shares) {
			conf.push(SHARE_TEMPLATE
				.replaceAll('{{SHARE_NAME}}', share.name)
				.replaceAll('{{SHARE_DIR}}', share.dir)
				.replaceAll('{{VALID_USERS}}', this.host.username)
				.replaceAll('{{WRITABLE}}', share.writable === false ? 'no' : 'yes')
				.replaceAll('{{BROWSEABLE}}', share.browseable ? 'yes' : 'no')
				.replaceAll('{{PUBLIC}}', share.public ? 'yes' : 'no')
				.replaceAll('{{HOSTS_ALLOW}}', share.networks.map(n => n.tailing).join(' '))
			);
		}

		return conf.join('\n');
	};

	@action('install')
	async install() {
		// ensure samba dirs exist with correct permissions
		const confDirs = ['lock', 'state', 'cache', 'private'];
		await this.mkdir('/run/samba');
		await this.mkdir('/var/lib/samba', {
			owner: 'root',
			permissions: '700',
		});

		await Promise.all(confDirs.map(async dir => {
			const perms = dir === 'private' ? '700' : '755';
			await this.mkdir(`/var/lib/samba/${dir}`, {
				owner: 'root',
				permissions: perms,
			});
		}));
	}

	@action('sync')
	async sync() {
		await this.write('/etc/samba/smb.conf', this.configContents, {
			owner: 'root',
		});
		await Promise.all(this.props.shares.map(s => this.cmd(`mkdir -p ${s.dir}`)));
		await this.cmd(`echo -e "${this.props.password}\\n${this.props.password}" | sudo smbpasswd -a -s ${this.host.username}`);
		await this.cmd(`sudo smbpasswd -e ${this.host.username}`);
	}

	@action('status')
	async status() {
		await this.cmd('sudo smbstatus');
	}

	@action('uninstall')
	async uninstall() {
		await this.cmd('sudo apt remove --purge samba samba-common-bin -y');
	}

	@action('debug')
	async filesDebug() {
		await this.cmd('sudo testparm -s /etc/samba/smb.conf', {
			noFail: true,
			noTrim: true,
		});
	}
});
