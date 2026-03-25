import Host from '../../../core/host/host';
import * as props from './props';

export default new Host('crazy-clock', {
	ip: '192.168.1.10',
	username: 'user',
	groups: ['all-devices', 'raspberry-pi'],
	services: props,
});
