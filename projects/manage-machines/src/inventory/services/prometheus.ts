import { action } from '../../core/service/annotations';
import { sysdService } from '../../core/service/service-factory';
import { getHostsWithService } from '../hosts';
import { ServiceName } from '../services';

export type PrometheusProps = {
	sources?: {
		name: string;
		service: string;
		portName: string;
	}[];
	ports?: {
		http?: number;
	};
};

const VERSION = '3.10.0';
const DOWNLOAD_URL = `https://github.com/prometheus/prometheus/releases/download/v${VERSION}/prometheus-${VERSION}.linux-armv7.tar.gz`;
const UNIT_TEMPLATE = `
[Unit]
Description=Prometheus Server
After=network-online.target

[Service]
User={{SERVICE_USERNAME}}
Restart=on-failure

ExecStart={{INSTALL_PATH}}/prometheus \\
--config.file={{INSTALL_PATH}}/prometheus.yml \\
--storage.tsdb.path={{INSTALL_PATH}}/data

[Install]
WantedBy=multi-user.target
`;
const CONFIG_FILE_TEMPLATE = `
global:
  scrape_interval: 1m
  # evaluation_interval: 15s # Evaluate rules every 15 seconds. The default is every 1 minute.
  # scrape_timeout is set to the global default (10s).

scrape_configs:
  # The job name is added as a label 'job=' to any timeseries scraped from this config.
  - job_name: "prometheus"
    static_configs:
      - targets: ["127.0.0.1:{{HTTP_PORT}}"]
{{SRAPE_JOBS}}
`;

export default sysdService<PrometheusProps>()({
	name: 'prometheus',
	isDirMaster: true,
	mixinRsync: 'no-triggers',
	unitFileTemplate: UNIT_TEMPLATE,
	debugFiles: ['prometheus.yml'],
	ports: {
		http: 9090,
	},
	props: {
		sources: [
			{ name: 'node', service: 'prom-node-exporter', portName: 'http' },
			{ name: 'processes', service: 'prom-process-exporter', portName: 'http' },
			{ name: 'rh-sensors', service: 'rh-sensors', portName: 'http' },
			{ name: 'rh-event-devices', service: 'rh-event-devices', portName: 'http' },
			{ name: 'mediamtx', service: 'mediamtx', portName: 'metrics' },
			{ name: 'cadvisor', service: 'cadvisor', portName: 'cadvisor' },
			{ name: 'pihole', service: 'pihole', portName: 'prometheus' },
		],
	},
})(Base => class extends Base {
	@(action('install').optional('build'))
	async install() {
		const hasDataFolder = await this.dirNotEmpty('data');

		if (!this.flagsSkip('build') || !hasDataFolder) {
			const tarFileName = `prometheus-${VERSION}.linux-armv7.tar.gz`;
			const tmpPrometheusDir = `prometheus-${VERSION}.linux-armv7`;

			await this.cmd(`rm -rf /tmp/${tarFileName} /tmp/${tmpPrometheusDir}`);
			await this.cmd(`cd ${this.workDir} && ls --hide=data | xargs -d '\n' rm -rf`, {
				noFail: true,
			});
			await this.cmd(`cd /tmp && wget ${DOWNLOAD_URL} && tar xfz ${tarFileName}`);
			await this.cmd(`mv /tmp/${tmpPrometheusDir}/* ${this.workDir}/ && rm -rf /tmp/${tarFileName} /tmp/${tmpPrometheusDir}`);
		}

		if (!hasDataFolder) {
			const syncBackup = await this.promptWantingYes('Sync local backup to new install?');
			if (syncBackup) {
				await this.rsyncUp({
					localSubPath: 'data',
				});
			}
		}
	}

	@action('backup')
	async backup() {
		await this.triggerAction('stop');
		await this.rsyncDown({
			remoteSubPath: 'data',
		});
		await this.triggerAction('start');
	}

	@action('sync')
	async sync() {
		const scrapeJobs = this.props.sources!.flatMap(s => {
			const serviceName = s.service as ServiceName;
			const hosts = getHostsWithService(serviceName);

			return [
				`  - job_name: "${s.name}"`,
				`    metrics_path: "/metrics"`,
				'    static_configs:',
				...hosts.flatMap(h => ([
					// @ts-expect-error
					`      - targets: ["${h.ip}:${h.service(serviceName).port(s.portName)}"]`,
					`        labels:`,
					`          hostname: "${h.name}"`,
				])),
			];
		}).join('\n') || '';

		const promYml = CONFIG_FILE_TEMPLATE
			.replace('{{HTTP_PORT}}', String(this.port('http')))
			.replace('{{SRAPE_JOBS}}', scrapeJobs);
		await this.write('prometheus.yml', promYml);
	}
});
