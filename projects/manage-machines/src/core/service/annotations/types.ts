export type Action =
	'sudo' | 'install' | 'build' | 'sync' | 'deps' |
	'start' | 'stop' | 'restart' | 'status' | 'logs' |
	'disable' | 'enable' | 'uninstall' |
	'test' | 'backup' | 'dev' | 'debug' | 'configs' | 'urls';

// TODO - add `ActionAlias` type that groups multiple actions together OR is an alias to a `service action` pair
//   reboot - `system restart`
//   pip - `sync,deps,restart`

export type FlagBoolean = 'nofail' | 'follow' | 'reboot' | 'force' | 'verbose' | 'dryrun' | 'noprompt';
export type FlagString = 'start' | 'end';
export type FlagNumber = 'number';
export type FlagFilterable = 'skip' | 'include' | 'child';

export type FlagGeneric = FlagBoolean | FlagString | FlagNumber;
export type FlagGenericType = 'boolean' | 'number' | 'string';
export type Flag = FlagGeneric | FlagFilterable;
export type FlagsOpts = Partial<Record<Flag, string[] | true>>;

export type Hook =
	'install.begin' | 'install.sync.begin' | 'install.sync.end' | 'install.end' | 'install.final'
	| 'uninstall.begin' | 'uninstall.end' | 'uninstall.final'
	| 'sync.begin' | 'sync.end' | 'sync.final';

export type AnnotationType = 'actionManager' | 'action' | 'hook';

export type MethodFilterMode = 'required' | 'optional';

export type HandlerMethod = string | symbol;

export type ServiceMeta = {
	hooks: Map<Hook, Set<HandlerMethod>>;
	actions: Map<Action, Set<HandlerMethod>>;
	actionManagers: Map<Action, Set<HandlerMethod>>;
	flags: Map<Action, Map<Flag, Set<string> | true>>;
	methodFilters: Map<HandlerMethod, Map<MethodFilterMode, Set<string>>>;
};

export type ServiceMetaKey = Hook | Action;
