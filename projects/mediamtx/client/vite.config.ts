import path from 'path';
import { mergeConfig } from 'vite';
import createSharedConfig from '../../redhouse-platform/node/vite/vite.config';

export default mergeConfig(
	createSharedConfig(path.resolve(process.cwd())),
	{ publicDir: false }
);
