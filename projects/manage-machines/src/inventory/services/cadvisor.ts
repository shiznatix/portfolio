import { dockerService } from '../../core/service/service-factory';

export type CadvisorProps = {
	ports?: {
		cadvisor?: number;
		redis?: number;
	};
};

const COMPOSE_FILE = `services:
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    ports:
      - \${CADVISOR_PORT}:\${CADVISOR_PORT}
    command:
      - '-port=\${CADVISOR_PORT}'
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:rw
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    depends_on:
      - redis
    restart: unless-stopped
  redis:
    image: redis:latest
    container_name: redis
    ports:
      - \${REDIS_PORT}:\${REDIS_PORT}
    restart: unless-stopped
`;

export default dockerService<CadvisorProps>()({
	name: 'cadvisor',
	mixinRsync: 'no-triggers',
	ports: {
		cadvisor: 3000,
		redis: 3100,
	},
})(Base => class extends Base {
	dockerComposeFile = COMPOSE_FILE;
	configEnv = {
		CADVISOR_PORT: this.port('cadvisor'),
		REDIS_PORT: this.port('redis'),
	};
});
