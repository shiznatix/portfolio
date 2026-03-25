import { pythonService } from '../../core/service/service-factory';

export type LedTestProps = {
	numPixels: number;
};

export default pythonService<LedTestProps>()({
	name: 'led-test',
})(Base => class extends Base {
	configEnv = {
		NUM_PIXELS: this.props.numPixels.toString(),
	};
});
