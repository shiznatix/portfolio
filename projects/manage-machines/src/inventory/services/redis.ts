import { action } from '../../core/service/annotations';
import { sysdService } from '../../core/service/service-factory';

export type RedisProps = {
	ports?: {
		redis?: number;
	};
};

export default sysdService<RedisProps>()({
	name: 'redis',
	unitName: 'redis-server',
	aptDependencies: [
		'redis-server',
	],
	debugFiles: [{
		path: '/etc/redis/redis.conf',
		sudo: true,
	}],
	ports: {
		redis: 6379,
	},
})
(Base => class extends Base {
	sudoers = [
		'/usr/bin/sed * /etc/redis/redis.conf',
		'/usr/bin/tee * /etc/redis/redis.conf',
		'/usr/bin/cat /etc/redis/redis.conf',
		`/usr/sbin/usermod -a -G redis ${this.host.username}`,
	];

	@action('install')
	async install() {
		const port = this.port('redis');

		await this.cmd(`sudo usermod -a -G redis ${this.host.username}`);
		await this.configReplace('/etc/redis/redis.conf', {
			commentOut: [
				'port ', 'bind ', 'protected-mode ',
			],
			config: [
				'supervised auto',
				`port ${port}`,
				'bind * -::*',
				'unixsocket /run/redis/redis-server.sock',
				'unixsocketperm 770',
				'protected-mode no',
			],
		});
	}

	@action('uninstall')
	async uninstall() {
		await this.cmd('sudo apt remove --purge redis-server -y');
	}
});
