import { pythonService } from '../../core/service/service-factory';

export type RhMcpProps = {
	ports?: {
		http?: number;
	};
};

export default pythonService<RhMcpProps>()({
	name: 'rh-mcp',
	configJson: true,
	unitFileTemplate: 'service',
	ports: {
		http: 5350,
	},
})(Base => class extends Base {
});
