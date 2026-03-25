import { action } from '../../core/service/annotations';
import { sysdService } from '../../core/service/service-factory';

export type FtpServerProps = {
	dir: string;
};

export default sysdService<FtpServerProps>()({
	name: 'ftp-server',
	unitName: 'vsftpd',
	aptDependencies: [
		'vsftpd',
	],
	debugFiles: [
		'/etc/vsftpd.conf',
		'/etc/vsftpd.userlist',
	],
})(Base => class extends Base {
	@action('sync')
	async sync() {
		const confLines = [
			'listen=YES',
			'listen_ipv6=NO',
			'anonymous_enable=NO',
			'local_enable=YES',
			'userlist_enable=YES',
			'userlist_file=/etc/vsftpd.userlist',
			'userlist_deny=NO',
			'chroot_local_user=YES',
			'allow_writeable_chroot=YES',
			'write_enable=YES',
			`local_root=${this.props.dir}`,
		].join('\n');
		await this.write('/etc/vsftpd.conf', confLines, {
			owner: 'root',
			permissions: '600',
		});

		await this.cmd(`echo ${this.host.username} | sudo tee /etc/vsftpd.userlist`);
		await this.cmd(`sudo chmod 600 /etc/vsftpd.userlist`);

		await this.cmd(`mkdir -p ${this.props.dir}`);
		await this.cmd(`chmod 755 ${this.props.dir}`);
	}

	@action('uninstall')
	async uninstall() {
		await this.cmd('sudo apt remove --purge vsftpd -y');
	}
});
