import rhpy

from config import Config
import servers
import detectors
from read_streams import ReadStream

def init():
	detectors.init()

	for name, read_config in Config.read_streams.items():
		follower = ReadStream(name, read_config)
		rhpy.thread(follower.run, name=f'ReadStream.{name}')

	input_server = servers.InputServer('in', Config.input_port)
	rhpy.thread(input_server.run, name='Server.Input')

	output_server = servers.OutputServer('out', Config.output_port)
	rhpy.thread(output_server.run, name='Server.Output')

if __name__ == '__main__':
	rhpy.run(Config, init=init)
