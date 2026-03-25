import { Type } from '@sinclair/typebox';
import chalk from 'chalk';
import { CCommon, CService, CServiceCommon } from '../configs';
import { withMixin } from '../mixin-factory';
import { action } from '../annotations';
import { prettyJson } from '../../../utils';
import flags from '../common/flags';
import files from '../common/files';
import sysd from './sysd';

const CLIENT_EXEC_START = '{{INSTALL_PATH}}/.venv/bin/python -m http.server {{HTTP_PORT}} --bind 0.0.0.0 --directory public';
const CLIENT_EXEC_START_POST = `/bin/bash -c "sleep 2; echo '--------'; echo 'Client is available at:'; echo '  {{HTTP_URL}}'; echo '--------';"`;
const SERVICE_EXEC_START = '{{SUDO}}{{INSTALL_PATH}}/.venv/bin/python -u {{SRC_DIR}}/main.py';

const SERVICE_TEMPLATE = `[Unit]
Description={{DESCRIPTION}}
After={{UNIT_AFTER}}

[Service]
{{SERVICE_EXTRA_CONFIG}}
{{SERVICE_CLEANUP_PORTS}}
{{EXEC_START_PRE}}
ExecStart={{EXEC_START}}
{{EXEC_START_POST}}
Environment=PYTHONUNBUFFERED=1
# Environment=PYTHONDONTWRITEBYTECODE=1
Environment=SERVICE_NAME=%p
{{ENVIRONMENT}}
User={{SERVICE_USERNAME}}
WorkingDirectory={{INSTALL_PATH}}
StandardOutput=journal
StandardError=journal
SyslogIdentifier={{SERVICE_NAME}}
Restart=on-failure
RestartSec=5
TimeoutStopSec=15
KillMode=control-group
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
`;
const TIMER_TEMPLATE = `[Unit]
Description={{DESCRIPTION}}

[Timer]
OnBootSec={{ON_BOOT_SEC}}s
OnUnitActiveSec={{ON_UNIT_ACTIVE_SEC}}s
Unit={{UNIT_NAME}}.service

[Install]
WantedBy=timers.target
`;
const TIMER_TARGET_TEMPLATE = `[Unit]
Description={{DESCRIPTION}}
After=systemd-journald.service
Requires=systemd-journald.service

[Service]
Type=oneshot
ExecStart={{EXEC_START}}
{{ENVIRONMENT}}
User={{SERVICE_USERNAME}}
WorkingDirectory={{INSTALL_PATH}}
`;

const unitFile = withMixin(
	'unitFile',
	Type.Intersect([
		CCommon.WorkDir,
		CServiceCommon.UnitFile,
		Type.Partial(CService.Sysd),
		Type.Partial(CCommon.LocalDir),
		Type.Partial(CCommon.ConfigJson),
		Type.Partial(CCommon.Python),
	]),
	flags, files, sysd
)(Base => class extends Base {
	private isClientTemplate = this.unitFileTemplate === 'client';
	private isServiceTemplate = this.unitFileTemplate === 'service';
	private isTimerTemplate = this.unitFileTemplate === 'timer';
	private isTimerTargetTemplate = this.unitFileTemplate === 'timer-target';
	private httpPort = this.props.ports?.http;
	// @ts-expect-error
	private cleanupPorts = this.unitOwnedPorts?.map(p => `${this.port(p)}/tcp`).join(' ');
	private replacements = {
		DESCRIPTION: this.unitDescription || this.name,
		SERVICE_NAME: this.name,
		SERVICE_USERNAME: this.host.username,
		SUDO: this.unitExecSudo ? 'sudo ' : '',
		INSTALL_PATH: this.workDir,
		CONFIG_FILE_NAME: this.configJsonFileName || `config.json`,
		SRC_DIR: 'src',
		UNIT_NAME: this.unitName,
		UNIT_AFTER: this.unitStartAfter ?? 'network-online.target',
		EXEC_START_PRE: this.unitExecStartPre ? `ExecStartPre=${this.unitExecStartPre}` : '',
		EXEC_START: this.unitExecStart ?? (this.isClientTemplate
			? CLIENT_EXEC_START
			: this.isServiceTemplate
				? SERVICE_EXEC_START
				: ''
		),
		EXEC_START_POST: this.unitExecStartPost
			? `ExecStartPost=${this.unitExecStartPost}`
			: this.isClientTemplate
				? `ExecStartPost=${CLIENT_EXEC_START_POST}`
				: '',
		HTTP_PORT: this.httpPort ?? '',
		HTTP_URL: this.httpPort ? this.url() : '',
		SERVICE_CLEANUP_PORTS: this.cleanupPorts
			? ['ExecStartPre', 'ExecStopPost'].map(e => `${e}=-/usr/bin/fuser -k ${this.cleanupPorts}`).join('\n')
			: '',
			// 	// @ts-expect-error
			// 	`-/usr/bin/fuser -k ${this.port(p)}/tcp`
			// ).flatMap(cmd => [
			// 	`ExecStartPre=${cmd}`,
			// 	`ExecStopPost=${cmd}`,
			// ]).join('\n')
			// : '',
		SERVICE_EXTRA_CONFIG: this.httpPort === 80
			? 'AmbientCapabilities=CAP_NET_BIND_SERVICE'
			: '',
		ON_BOOT_SEC: this.unitTimerOnBootSec || 5,
		ON_UNIT_ACTIVE_SEC: this.unitTimerOnUnitActiveSec || 30,
		ENVIRONMENT: this.unitEnvironment
			? Object.entries(this.unitEnvironment).map(([key, value]) => `Environment=${key}=${value}`).join('\n')
			: '',
		...(typeof this.unitFileReplacements === 'object' ? this.unitFileReplacements : {}),
	};

	private async getTemplate() {
		if (this.unitFileTemplate) {
			return (this.isClientTemplate || this.isServiceTemplate)
				? SERVICE_TEMPLATE
				: this.isTimerTemplate
					? TIMER_TEMPLATE
					: this.isTimerTargetTemplate
						? TIMER_TARGET_TEMPLATE
						: this.unitFileTemplate;
		}

		const path = this.localDir
			? `${this.localDir}/${this.unitFileName}`
			: `${this.workDir}/${this.unitFileName}`;

		return await this.read(path, {
			local: !!this.localDir,
		});
	}

	private async getContents() {
		let contents = await this.getTemplate();
		// do 2 passes in case some replacements depend on other replacements
		for (let i = 0; i < 2; i++) {
			for (const [key, value] of Object.entries(this.replacements)) {
				contents = contents.replaceAll(`{{${key}}}`, value);
			}
		}
		return contents;
	}

	@action('sync')
	async unitFileSync() {
		const contents = await this.getContents();
		await this.write(this.unitFileName, contents);
		if (this.kind === 'sysd') {
			await this.sysdReload();
		}
	}

	@(action('debug').optional('replacements'))
	protected unitFileReplacementsPrint() {
		this.log(chalk.bold('--- Unit File Replacements ---'));
		this.log(prettyJson(this.replacements));
		this.log(chalk.bold('--- /Unit File Replacements ---'));
	}

	@(action('debug').optional('template'))
	protected async unitFileTemplatePrint() {
		const template = await this.getTemplate();
		const contents = await this.getContents();
		this.log(chalk.bold('--- Unit File Template ---'));
		this.log(template);
		this.log(chalk.bold('--- /Unit File Template ---'));
		this.log(chalk.bold('--- Unit File Contents ---'));
		this.log(contents);
		this.log(chalk.bold('--- /Unit File Contents ---'));
	}
});

export default unitFile;
