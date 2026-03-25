import { CameraConfig } from './types';

export {};

declare global {
	interface WindowConfig {
		name: string;
		color: string;
		cameras: Omit<CameraConfig, 'key' | 'streamTypes'>[];
	}
}
