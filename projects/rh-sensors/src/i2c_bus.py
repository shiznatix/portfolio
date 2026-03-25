import board
import busio

def get(port: int):
	if port == 0:
		return busio.I2C(sda=0, scl=1)
	return board.I2C()
