import faulthandler
faulthandler.enable()

import rhpy.web

from receivers import receivers
import handlers
from config import Config

def init():
	for receiver in receivers.get_all():
		rhpy.thread(receiver.init_and_run)

if __name__ == '__main__':
	rhpy.web.run(Config, http_routes=handlers.router, init=init)
