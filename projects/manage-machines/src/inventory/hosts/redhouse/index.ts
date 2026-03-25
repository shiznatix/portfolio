import Host from '../../../core/host/host';
import * as props from './props';

export default new Host('redhouse', {
	ip: '192.168.1.11',
	username: 'user',
	groups: ['all-devices', 'raspberry-pi'],
	services: props,
});
