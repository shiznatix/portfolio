import type Host from '../host/host';
import { ArgvFlags, Constructor } from '../../types';
import { getCallerName, makeInstancePropMap } from '../../utils';
import logger, { LoggerInstance } from '../../logger';
import { Config } from './configs';
import { applyMixins, applyRunners } from './mixins';
import { CmdOpts } from '../host/types';
import { InferPorts, IService } from './service-types';
import ServiceUrls from './service-urls';

const makeService = <P, N extends string, C extends Config.Service>(
	name: N,
	config: C,
	defProps?: Partial<P>,
	extend?: (Base: Constructor<any>) => Constructor<any>,
) => {
	function make(host: Host, props: P, argvFlags: ArgvFlags) {
		const httpPortKey = (config as any).httpPort as string | undefined;
		const merged = (defProps ? { ...defProps, ...props } : props) as any;
		const mergedProps: P = (httpPortKey && merged?.ports?.[httpPortKey])
			? { ...merged, ports: { ...merged.ports, http: merged.ports[httpPortKey] } }
			: merged;

		class Service extends ServiceUrls<P> implements IService<P, N> {
			static __mixinInstance?: Service;
			static readonly __mixins: Record<string, true | string[]> = {};
			static readonly __config = config;
			static readonly __name = name;

			static mixinInstance(Base: Constructor<Service>): Service {
				if (!Service.__mixinInstance) {
					Service.__mixinInstance = new Base();
					Service.__mixinInstance.isMixinTestInstance = true;
				}
				return Service.__mixinInstance;
			}

			isMixinTestInstance: boolean = false;

			name: N;
			props: P;
			host: Host;
			flags: ArgvFlags;
			log: LoggerInstance

			constructor() {
				super();
				this.name = name;
				this.props = mergedProps;
				this.host = host;
				this.flags = argvFlags;
				this.log = logger({
					...config.logConfig,
					verbose: this.flags.verbose,
				});
			}

			hasProps() {
				return !!this.props && Object.keys(this.props).length > 0;
			}

			cmd(cmd: string, opts?: CmdOpts) {
				return this.host.cmd(cmd, {
					...opts,
					logger: this.log,
					dryRun: !!this.flags.dryrun,
					caller: this.flags.verbose ? getCallerName() : null,
				});
			}

			localCmd(cmd: string, args: string[] = [], opts: CmdOpts = {}) {
				return this.host.localCmd(cmd, args, {
					...opts,
					logger: this.log,
					dryRun: !!this.flags.dryrun,
				});
			}
		}

		const configPropMap = makeInstancePropMap(config);
		const Extended = extend ? extend(Service) : Service;
		Object.defineProperties(Extended.prototype, configPropMap);

		return applyRunners(
			applyMixins(Extended)
		) as Constructor<IService<P, N>>;
	}

	make.Name = name as N;
	make.Props = {} as P;
	make.BaseConfig = {} as typeof config;
	make.Service = {} as InstanceType<ReturnType<typeof make>>;

	return make;
};

export default makeService;
