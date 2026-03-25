import { action } from '../../core/service/annotations';
import { dockerService } from '../../core/service/service-factory';

type MysqlDbConfig = {
	name: string;
	pass: string;
	relativePath: string;
};

export type WwwProps = {
	certbotEmail: string;
	certDomainGroups: string[][];
	mysqlDbs: MysqlDbConfig[];
	fileUploadDirs: string[];
	certsFolder: string;
	runEnv: 'production' | 'development';
	ports?: {
		http?: number;
		https?: number;
	};
};

export default dockerService<WwwProps>()({
	name: 'www',
	snapDependencies: ['certbot'],
	snapDependenciesFlags: {
		classic: true,
	},
	ports: {
		http: 80,
		https: 443,
	},
})(Base => class extends Base {
	proxyContainerName = 'nginx-proxy';
	containerNames = [
		this.proxyContainerName,

		'somesite-www',

		'foo-mysql', 'foo-www',
		'foodev-mysql', 'foodev-www',
	];
	sudoers = [
		`/usr/bin/snap install --classic certbot`,
		`/snap/bin/certbot certonly *`,
		`/usr/bin/rm -rf ${this.workDir}`,
	];
	configEnv = {
		HTTP_PORT: this.port('http'),
		HTTPS_PORT: this.port('https'),
		RUN_ENV: this.props.runEnv,
		CERTS_FOLDER: this.props.certsFolder,
		...this.props.mysqlDbs.reduce((acc, curr) => {
			acc[`${curr.name.toUpperCase()}_MYSQL_PASS`] = curr.pass;

			return acc;
		}, {} as { [key: string]: string }),
	};

	@action('install')
	async install() {
		const pullFromRemote = await this.promptWantingYes('Pull DBs and uploaded files from remote first?');
		if (pullFromRemote) {
			await this.triggerAction('backup');
		}

		// slightly special since we need to make sure we have certs...
		// await this.sync();
		// await this.dockerCmd('pull');
		// await this.dockerCmd('build', '--pull');
		// await this.update();
		// await this.start();
	}

	@action('backup')
	async backup() {
		const dumpDb = async (dbConf: MysqlDbConfig) => {
			const remotePath = `/tmp/${dbConf.name}.sql`;
			const localPath = dbConf.relativePath;
			await this.cmd(`docker exec ${dbConf.name}-mysql /usr/bin/mysqldump -u root --password=${dbConf.pass} ${dbConf.name} > ${remotePath}`);
			await this.scp('down', {
				localPath,
				remotePath,
			});
			await this.cmd(`rm ${remotePath}`);

			this.log.warn(`Dumped and copied database ${dbConf.name} to ${localPath}`);
		}

		// dump databases
		for (const dbConf of this.props.mysqlDbs) {
			await dumpDb(dbConf);
		}

		// copy files that are uploaded to the server since we wont keep a local copy
		for (const relDir of this.props.fileUploadDirs) {
			await this.rsyncDown({
				localSubPath: relDir,
				remoteSubPath: relDir,
			});
		}
	}

	@action('sync')
	async sync() {
		const excludes = [];
		const ignoreFileUploadDirs = await this.promptWantingYes('Skip syncing uploaded files?');
		if (ignoreFileUploadDirs) {
			excludes.push(...this.props.fileUploadDirs);
		}

		await this.rsyncUp({
			excludes,
		});
	}

	@action('deps')
	async deps() {
		// `certbot` will create a temp webserver to get verification for the domains.
		// If our services are running, we could have port conflicts. So, stop everything to be safe.
		const wasRunning = await this.dkrIsRunning(this.proxyContainerName);

		await this.dkrStop();

		for (const certDomains of this.props.certDomainGroups) {
			await this.cmd([
				`sudo -S certbot certonly --standalone --non-interactive --expand --agree-tos -m ${this.props.certbotEmail}`,
				...certDomains.map(d => `-d ${d}`),
			].join(' '));
		}

		if (wasRunning) {
			await this.dkrStart();
		}
	}
});
