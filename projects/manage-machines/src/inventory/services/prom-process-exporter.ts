import { action } from '../../core/service/annotations';
import { sysdService } from '../../core/service/service-factory';

export type PromProcessExporterProps = {
	services?: string[];
	ports?: {
		http?: number;
	};
};

export default sysdService<PromProcessExporterProps>()({
	name: 'prom-process-exporter',
	unitName: 'prometheus-process-exporter',
	aptDependencies: [
		'prometheus-process-exporter',
	],
	ports: {
		http: 9256,
	},
})(Base => class extends Base {
	@action('sync')
	async sync() {
		const configFile = [
			'process_names:',
		];
		if (this.props.services?.length) {
			for (const service of this.props.services) {
				configFile.push(`  - name: "${service}"`);
				configFile.push('    cmdline:');
				configFile.push(`      - '.*/var/lib/${service}.*'`);
			}
		} else {
			configFile.push('  - name: "{{.Comm}}"');
			configFile.push('    cmdline:');
			configFile.push(`      - '.+'`);
		}

		await this.configReplace(
			'/etc/prometheus-process-exporter.yml',
			configFile,
		);
		await this.cmd(`sudo sed -i '/^ARGS=""$/s/^/# /' /etc/default/prometheus-process-exporter`);
		await this.configReplace(
			'/etc/default/prometheus-process-exporter',
			`ARGS="--config.path=/etc/prometheus-process-exporter.yml --web.listen-address=:${this.port('http')}"`,
		);
	}

	@action('uninstall')
	async uninstall() {
		await this.cmd('sudo apt remove --purge prometheus-process-exporter');
		await this.cmd('sudo rm -f /etc/prometheus-process-exporter.yml');
		await this.cmd('sudo rm -f /etc/default/prometheus-process-exporter');
	}
});
