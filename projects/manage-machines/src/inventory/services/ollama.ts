import { action, hook } from '../../core/service/annotations';
import { sysdService } from '../../core/service/service-factory';

export type OllamaProps = {
	models?: string[];
	cuda?: boolean;
	ports?: {
		http?: number;
	};
};

const DOWNLOAD_URL = 'https://ollama.com/download/ollama-linux-amd64.tar.zst';
const TAR_NAME = 'ollama-linux-amd64.tar.zst';
const UNIT_TEMPLATE = `
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/bin/ollama serve
Environment="OLLAMA_HOST=0.0.0.0:{{HTTP_PORT}}"
{{CUDA_ENV}}
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="PATH=$PATH"

[Install]
WantedBy=multi-user.target
`;

export default sysdService<OllamaProps>()({
	name: 'ollama',
	isInstallDir: true,
	unitFileTemplate: UNIT_TEMPLATE,
	unitInstallable: true,
	props: {
		models: ['tinyllama'],
	},
	ports: {
		http: 11434,
	},
})(Base => class extends Base {
	didPull = false;
	tarPath = `/home/${this.host.username}/${TAR_NAME}`;
	unitFileReplacements = {
		CUDA_ENV: this.props.cuda
			? 'Environment="LD_LIBRARY_PATH=/usr/local/cuda/lib64:/usr/lib/x86_64-linux-gnu"'
			: '',
	};
	sudoers = [
		`/usr/bin/tar -I zstd -xf ${this.tarPath} -C /usr`,
		'/usr/sbin/useradd -r -s /bin/false -U -m -d /usr/share/ollama ollama',
		`/usr/sbin/usermod -a -G ollama ${this.host.username}`,
		'/usr/bin/systemctl * ollama',

		`/usr/bin/rm -f ${this.unitFilePath}`,
		`/usr/bin/rm ${this.unitFilePath}`,
		`/usr/bin/rm -r /usr/local/lib/ollama`,
		`/usr/bin/rm /usr/local/bin/ollama`,
		'/usr/sbin/userdel ollama',
		'/usr/sbin/groupdel ollama',
		'/usr/bin/rm -r /usr/share/ollama',
	];

	@action('install')
	async install() {
		let tarExists = await this.fileExists(this.tarPath);
		if (tarExists) {
			tarExists = await this.promptWantingYes('The Ollama installer tarball already exists. Do you want to reuse it?');
		}

		if (!tarExists) {
			await this.cmd(`rm -f ${this.tarPath}`);
			await this.cmd(`curl -fL -o ${this.tarPath} ${DOWNLOAD_URL}`);
		}
		await this.cmd(`sudo tar -I zstd -xf ${this.tarPath} -C /usr`);

		const userExists = await this.cmd('id -u ollama', { noFail: true });
		if (userExists.code !== 0) {
			await this.cmd('sudo useradd -r -s /bin/false -U -m -d /usr/share/ollama ollama');
		}
		await this.cmd(`sudo usermod -a -G ollama ${this.host.username}`);
	}

	@action('sync')
	@hook('install.final')
	async pullModels() {
		if (this.didPull) {
			return;
		}

		const sysdRunning = await this.sysdIsRunning();
		if (!sysdRunning) {
			this.log.warn('Ollama is not currently running, skipping model pull');
			return;
		}

		for (const model of this.props.models!) {
			await this.cmd(`ollama pull ${model}`);
		}
		this.didPull = true;
	}

	@action('uninstall')
	async uninstall() {
		const opts = { noFail: true };
		await this.cmd(`sudo rm -r /usr/local/lib/ollama`, opts);
		await this.cmd('sudo rm /usr/local/bin/ollama', opts);
		await this.cmd('sudo userdel ollama', opts);
		await this.cmd('sudo groupdel ollama', opts);
		await this.cmd('sudo rm -r /usr/share/ollama', opts);

		const { code: hasCacheCode } = await this.cmd(`test -d /home/${this.host.username}/.ollama`, opts);
		if (hasCacheCode === 0) {
			const delCache = await this.promptWantingNo('Do you want to delete all cached models and data?');
			if (delCache) {
				await this.cmd(`rm -rf /home/${this.host.username}/.ollama`, opts);
			}
		}
	}
});
