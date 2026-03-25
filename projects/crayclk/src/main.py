import rhpy.web

from config import Config
from clock import Clock
import handlers


def init():
	clock = Clock()
	rhpy.thread(clock.run, name='clock')

if __name__ == '__main__':
	rhpy.web.run(config=Config, http_routes=handlers.router, init=init)
