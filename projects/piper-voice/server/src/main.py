import rhpy
import rhpy.web

from config import Config
import voices
import history
import handlers

def init():
	voices.load(Config.default_voice)
	rhpy.thread(history.run_cleanup_loop)

if __name__ == '__main__':
	rhpy.web.run(Config, init=init, http_routes=handlers.router)
