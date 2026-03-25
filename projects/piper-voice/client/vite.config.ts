import path from 'path';
import createSharedConfig from '../../redhouse-platform/node/vite/vite.config';

export default createSharedConfig(path.resolve(process.cwd()));
