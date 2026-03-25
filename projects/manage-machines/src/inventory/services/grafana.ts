import { action, hook } from '../../core/service/annotations';
import { dockerService } from '../../core/service/service-factory';

export type GrafanaProps = {
	smtpEnabled?: boolean;
	smtpHost?: string;
	smtpPort?: number;
	smtpUser?: string;
	smtpPassword?: string;
	ports?: {
		http?: number;
		loki?: number;
	};
};

export default dockerService<GrafanaProps>()({
	name: 'grafana',
	containerNames: ['grafana', 'loki'],
	rsyncUpExcludes: [
		'data/',
	],
	installSubDirs: [
		'data',
		'data/grafana',
		'data/loki',
		'data/promtail',
	],
	ports: {
		http: 3000,
		loki: 3100,
	},
})(Base => class extends Base {
	configEnv = {
		ROOT_URL: this.url('http'),
		HTTP_PORT: this.port('http'),
		SMTP_ENABLED: this.props.smtpEnabled ? 'true' : '',
		SMTP_HOST: this.props.smtpHost || '',
		SMTP_PORT: this.props.smtpPort || 0,
		SMTP_USER: this.props.smtpUser || '',
		SMTP_PASSWORD: this.props.smtpPassword || '',
	};

	@hook('install.sync.end')
	async restoreBackup() {
		const hasDataFolder = await this.dirNotEmpty('data/grafana');
		if (!hasDataFolder) {
			const syncBackup = await this.promptWantingYes('Sync local backup to new install?');
			if (syncBackup) {
				await this.dkrStop();
				await this.rsyncUp({
					localSubPath: 'data/grafana/grafana.db',
					destSubPath: 'data/grafana/grafana.db',
				});
				await this.dkrStart();
			}
		}
	}

	@action('backup')
	async backup() {
		await this.rsyncDown({
			remoteSubPath: 'data/grafana/grafana.db',
			localSubPath: 'data/grafana',
		});
	}
});
