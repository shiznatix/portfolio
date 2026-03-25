import rhpy

class _Config(rhpy.Config):
	marionette_host: str = 'localhost'
	# self.marionette_port = conf.get('marionettePort', 2828)
	# self.marionette_host = conf.get('marionetteHost', 'localhost')
Config = _Config()
