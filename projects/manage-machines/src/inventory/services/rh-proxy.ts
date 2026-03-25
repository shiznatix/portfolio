import { pythonService } from '../../core/service/service-factory';

export type RhProxyProps = {
	routes: {
		path: string;
		destination: string;
	}[];
	ports?: {
		http?: number;
	};
};

export default pythonService<RhProxyProps>()({
	name: 'rh-proxy',
	unitFileTemplate: 'service',
	ports: {
		http: 80,
	},
})(Base => class extends Base {
	configJson = {
		...this.props,
		routes: this.props.routes,
	};
});
