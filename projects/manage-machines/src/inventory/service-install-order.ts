import { ServiceName } from './services';

export const serviceInstallOrder: ServiceName[] = [
	'system',
	'pi',
	'home-bin',
	'fstab',

	// 'wifi',
	'nordvpn',
	'ssh-to-hosts',

	'docker',
	'redis',
	'ollama',
	'piper-voice',
	'whisper-api',

	'nfs-client',
	'nfs-server',
	'samba-server',
	'ftp-server',

	// 'crayclk',
	'mediamtx',
	'browser-kiosk',
	// 'foney',
	'hide-cursor',
	'rh-alive',
	'rh-assistant',
	'rh-hub',
	'rh-proxy',
	'rh-sensors',
	'rh-event-devices',
	'rh-forecast',
	'rh-image-detector',
	'rh-mcp',
	'rh-rag',
	'rh-servos',
	'stream-screen',
	'web-scraper',
	'vlr',

	'led-matrix',
	'led-test',
	'ir-remote',
	'marbles-motor',

	'pihole',
	'www',
	'transmission-vpn',

	'minecraft-server',
	'valheim-server',
	'satisfactory-server',

	'prometheus',
	'alloy',
	'prom-node-exporter',
	'prom-process-exporter',
	'cadvisor',
	'grafana',
	'log-persistor',

	'cron',
	'lcd-display',
];
