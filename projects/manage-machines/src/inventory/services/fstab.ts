import { action, hook } from '../../core/service/annotations';
import { nakedService } from '../../core/service/service-factory';

type Ext4Mount = {
	label: string;
	path: string;
};
type NfsMount = {
	ip: string;
	path: string;
};
export type FstabProps = {
	mounts: (Ext4Mount | NfsMount)[];
};

const EXT4_OPTS = [
	'defaults',
	'nofail',
	'noatime',
	'user',
	'exec',
	'user_xattr',
].join(',');
const NFS_OPTS = [
	'defaults',
	'bg',
	'nofail',
	'x-systemd.automount',
	'x-systemd.requires=network-online.target',
	'x-systemd.device-timeout=10s',
	'x-systemd.idle-timeout=60',
	'soft',
	'timeo=30',
	'retrans=1',
	'retry=0',
].join(',');

export default nakedService<FstabProps>()({
	name: 'fstab',
	debugFiles: ['/etc/fstab'],
})(Base => class extends Base {
	private ext4(mount: Ext4Mount) {
		return `LABEL=${mount.label}     ${mount.path}   ext4   ${EXT4_OPTS}        0       0`;
	}

	private nfs(mount: NfsMount) {
		return `${mount.ip}:${mount.path} ${mount.path} nfs ${NFS_OPTS} 0 0`;
	}

	@action('install')
	async install() {
		for (const mount of this.props.mounts) {
			await this.cmd(`sudo mkdir -p ${mount.path}`);
			await this.cmd(`sudo chown ${this.host.username}:${this.host.username} ${mount.path}`);
		}

		await this.configReplace('/etc/fstab', this.props.mounts.map(m => 'label' in m ? this.ext4(m) : this.nfs(m)));
	}

	@action('start')
	@hook('install.end')
	async start() {
		await this.cmd('sudo systemctl daemon-reload');
		await this.cmd('sudo mount -a');
	}

	@action('uninstall')
	@hook('install.begin')
	async uninstall() {
		await this.configRemove('/etc/fstab');
		await this.cmd('sudo umount -a', {
			noFail: true,
		});
	}
});
