import { action } from '../../core/service/annotations';
import { sysdService } from '../../core/service/service-factory';

export type PromNodeExporterProps = {
	ports?: {
		http?: number;
	},
};

const NODE_EXPORTER_VERSION = '1.10.2';
const DOWNLOAD_URL_TEMPLATE = `https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-{{arch}}.tar.gz`;
const UNIT_TEMPLATE = `
[Unit]
Description=Prometheus Node Exporter
After=network-online.target

[Service]
User={{SERVICE_USERNAME}}
ExecStart={{INSTALL_PATH}}/node_exporter
StandardOutput=journal
StandardError=journal
SyslogIdentifier=prometheus-node-exporter
Restart=always
RestartSec=5
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
`;

export default sysdService<PromNodeExporterProps>()({
	name: 'prom-node-exporter',
	isInstallDir: true,
	unitFileTemplate: UNIT_TEMPLATE,
	ports: {
		http: 9100,
	},
})(Base => class extends Base {
	@(action('install').optional('build'))
	async install() {
		const installed = await this.fileExists('node_exporter');
		if (installed && !this.flagsIncludeExplicit('build')) {
			return;
		}

		const tarFileName = 'node-exporter.tar.gz';
		const sysArch = await this.arch();
		const pkgArch = sysArch === 'aarch64' ? 'arm64' : 'amd64';
		const downloadUrl = DOWNLOAD_URL_TEMPLATE.replace('{{arch}}', pkgArch);

		await this.cmd(`rm -f /tmp/${tarFileName}`);
		await this.cmd(`rm -f /tmp/node_exporter`);
		await this.cmd(`cd /tmp && wget -O ${tarFileName} ${downloadUrl}`);
		await this.cmd(`cd /tmp && tar -xvf ${tarFileName} --strip-components=1`);
		await this.cmd(`mv /tmp/node_exporter ${this.workDir}/`);
		await this.cmd(`rm /tmp/${tarFileName}`);
		await this.cmd(`rm -f /tmp/node_exporter`);
	}
});
