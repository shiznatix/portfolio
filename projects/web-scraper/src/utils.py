import time
from random import randrange

def randsleep(*, start: int = 1, end: int = 5, divisor: int = 10):
	time.sleep(randrange(start, end) / divisor)
