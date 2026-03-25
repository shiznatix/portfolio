import { Network } from '../../consts';
import { action } from '../../core/service/annotations';
import { nakedService } from '../../core/service/service-factory';

export type NfsServerProps = {
	shares: {
		folder: string;
		allowedNetworks: Network[];
	}[];
};

export default nakedService<NfsServerProps>()({
	name: 'nfs-server',
	aptDependencies: [
		'nfs-kernel-server',
	],
	debugFiles: [
		'/etc/exports',
	],
})(Base => class extends Base {
	sudoers = [
		'/usr/bin/mkdir -p /media/*',
		`/usr/bin/chown ${this.host.username}:${this.host.username} /media/*`,
		'/usr/bin/sed * /etc/exports',
		'/usr/bin/tee *',
		'/usr/bin/rm * /etc/exports',
		'/usr/sbin/exportfs -ra',
	];

	@action('sync')
	async sync() {
		const exportsLines: string[] = [];

		for (const share of this.props.shares) {
			await this.mkdir(share.folder, {
				owner: this.host.username,
			});

			const networks = share.allowedNetworks.map(n => `${n.mask}(rw,sync,no_subtree_check)`).join(' ');
			exportsLines.push(`${share.folder} ${networks}`);
		}

		await this.configReplace('/etc/exports', exportsLines.join('\n'));
	}

	@action('start')
	async start() {
		await this.cmd('sudo exportfs -ra');
	}

	@action('uninstall')
	async uninstall() {
		await this.cmd('sudo apt remove --purge nfs-kernel-server -y');
		await this.cmd('sudo rm -rf /etc/exports');
	}
});
