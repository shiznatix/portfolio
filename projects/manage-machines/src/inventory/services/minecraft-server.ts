import { action } from '../../core/service/annotations';
import { dockerService } from '../../core/service/service-factory';

export type MinecraftServerProps = {
	bedrock?: {
		cheats?: boolean;
		admins?: (number | string)[];
		mode?: 'survival' | 'creative' | 'adventure' | 'spectator';
	};
	java?: {
		admins?: (number | string)[];
	};
	ports?: {
		bedrock?: number;
		java?: number;
	};
};

const COMPOSE_FILE = `services:
  minecraft-bedrock-server:
    container_name: 'minecraft-bedrock-server'
    hostname: 'minecraft-bedrock-server'
    image: 'itzg/minecraft-bedrock-server:latest'
    profiles:
      - bedrock-server
    ports:
      - '\${BEDROCK_PORT}:\${BEDROCK_PORT}/udp'
    volumes:
      - './bedrock-server-data:/data'
    environment:
      - EULA=TRUE
      - TZ=The/World
      - ALLOW_CHEATS=\${BEDROCK_ALLOW_CHEATS}
      - OPS='\${BEDROCK_ADMINS}'
      - GAMEMODE=\${BEDROCK_GAME_MODE}
    stdin_open: true
    tty: true
    restart: unless-stopped

  minecraft-server:
    container_name: 'minecraft-server'
    hostname: 'minecraft-server'
    image: 'itzg/minecraft-server:latest'
    profiles:
      - java-server
    ports:
      - \${JAVA_PORT}:\${JAVA_PORT}
    volumes:
      - './java-server-data:/data'
    environment:
      - EULA=TRUE
      - TZ=The/World
    stdin_open: true
    tty: true
    restart: unless-stopped
`;

export default dockerService<MinecraftServerProps>()({
	name: 'minecraft-server',
	installSubDirs: [
		'bedrock-server-data',
		'java-server-data',
	],
	mixinRsync: 'no-triggers',
	props: {
		bedrock: {
			cheats: true,
			admins: [],
		},
	},
	ports: {
		bedrock: 19132,
		java: 25565,
	},
})(Base => class extends Base {
	dockerComposeFile = COMPOSE_FILE;
	configEnv = {
		COMPOSE_PROFILES: [
			this.props.bedrock && 'bedrock-server',
			this.props.java && 'java-server',
		].filter(p => p).join(','),
		BEDROCK_PORT: this.port('bedrock'),
		BEDROCK_ALLOW_CHEATS: this.props.bedrock?.cheats ? 'true' : '',
		BEDROCK_ADMINS: this.props.bedrock?.admins?.join(',') || '',
		BEDROCK_GAME_MODE: this.props.bedrock?.mode || 'survival',
		JAVA_PORT: this.port('java'),
	};

	@action('backup')
	async backup() {
		await this.rsyncDown({
			remoteSubPath: 'bedrock-server-data/',
			localSubPath: 'bedrock-server-data',
		});
		await this.rsyncDown({
			remoteSubPath: 'java-server-data/',
			localSubPath: 'java-server-data',
		});
	}
});
