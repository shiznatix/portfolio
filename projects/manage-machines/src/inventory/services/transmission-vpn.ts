import { Network } from '../../consts';
import { dockerService } from '../../core/service/service-factory';

export type TransmissionVpnProps = {
	downloadDir: string;
	protocol: string;
	localNetwork: Network;
	provider: string;
	country: string;
	category: string;
	configName: string;
	username: string;
	password: string;
};

export default dockerService<TransmissionVpnProps>()({
	name: 'transmission-vpn',
})(Base => class extends Base {
	configEnv = {
		DOWNLOAD_DIR: this.props.downloadDir,
		PROTOCOL: this.props.protocol,
		LOCAL_NETWORK: this.props.localNetwork.glob,
		PROVIDER: this.props.provider,
		COUNTRY: this.props.country,
		CATEGORY: this.props.category,
		CONFIG_NAME: this.props.configName,
		USERNAME: this.props.username,
		PASSWORD: this.props.password,
	};
	rsyncUpExcludes = [
		'config',
		this.props.downloadDir,
	];
	installSubDirs = [
		'config',
		this.props.downloadDir,
	];
});
