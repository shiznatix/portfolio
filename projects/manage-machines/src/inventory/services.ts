import { arrayUnique, camelToKebab } from '../utils';
import alloy from './services/alloy';
import browserKiosk from './services/browser-kiosk';
import cadvisor from './services/cadvisor';
import crayclk from './services/crayclk';
import cron from './services/cron';
import docker from './services/docker';
import foney from './services/foney';
import fstab from './services/fstab';
import ftpServer from './services/ftp-server';
import grafana from './services/grafana';
import hideCursor from './services/hide-cursor';
import homeBin from './services/home-bin';
import irRemote from './services/ir-remote';
import lcdDisplay from './services/lcd-display';
import ledMatrix from './services/led-matrix';
import ledTest from './services/led-test';
import logPersistor from './services/log-persistor';
import marblesMotor from './services/marbles-motor';
import mediamtx from './services/mediamtx';
import minecraftServer from './services/minecraft-server';
import nfsClient from './services/nfs-client';
import nfsServer from './services/nfs-server';
import nordVpn from './services/nordvpn';
import ollama from './services/ollama';
import pi from './services/pi';
import piHole from './services/pihole';
import piperVoice from './services/piper-voice';
import promNodeExporter from './services/prom-node-exporter';
import promProcessExporter from './services/prom-process-exporter';
import prometheus from './services/prometheus';
import redis from './services/redis';
import rhAlive from './services/rh-alive';
import rhAssistant from './services/rh-assistant';
import rhEventDevices from './services/rh-event-devices';
import rhForecast from './services/rh-forecast';
import rhHub from './services/rh-hub';
import rhImageDetector from './services/rh-image-detector';
import rhMcp from './services/rh-mcp';
import rhProxy from './services/rh-proxy';
import rhRag from './services/rh-rag';
import rhSensors from './services/rh-sensors';
import rhServos from './services/rh-servos';
import sambaServer from './services/samba-server';
import satisfactoryServer from './services/satisfactory-server';
import sshToHosts from './services/ssh-to-hosts';
import streamScreen from './services/stream-screen';
import system from './services/system';
import transmissionVpn from './services/transmission-vpn';
import valheimServer from './services/valheim-server';
import vlr from './services/vlr';
import webScraper from './services/web-scraper';
import whisperApi from './services/whisper-api';
import wifi from './services/wifi';
import www from './services/www';

export type ServiceName = typeof services[number]['Name'];
export type Services<N extends ServiceName> = Extract<typeof services[number], { Name: N }>['Service'];
export type ServiceProps = {
	[K in ServiceName]: Extract<typeof services[number], { Name: K }>['Props']
};

const services = [
	alloy,
	browserKiosk,
	cadvisor,
	crayclk,
	cron,
	docker,
	foney,
	fstab,
	ftpServer,
	grafana,
	hideCursor,
	homeBin,
	irRemote,
	lcdDisplay,
	ledMatrix,
	ledTest,
	logPersistor,
	marblesMotor,
	mediamtx,
	minecraftServer,
	nfsClient,
	nfsServer,
	nordVpn,
	ollama,
	pi,
	piHole,
	piperVoice,
	promNodeExporter,
	promProcessExporter,
	prometheus,
	redis,
	rhAlive,
	rhAssistant,
	rhEventDevices,
	rhForecast,
	rhHub,
	rhImageDetector,
	rhMcp,
	rhProxy,
	rhRag,
	rhSensors,
	rhServos,
	sambaServer,
	satisfactoryServer,
	sshToHosts,
	streamScreen,
	system,
	transmissionVpn,
	valheimServer,
	vlr,
	webScraper,
	whisperApi,
	wifi,
	www,
] as const;

export const getService = (name: ServiceName) => {
	const kebabName = camelToKebab(name);
	const service = services.find(s => s.Name === kebabName)!;
	if (!service) {
		throw new Error(`Service ${kebabName} not found`);
	}
	return service;
};
export const getServices = (names: ServiceName[]) => {
	return arrayUnique(names.map(n => getService(n)));
};
