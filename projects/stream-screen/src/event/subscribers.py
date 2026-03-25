from typing import Callable, Any, Optional
from dataclasses import dataclass

@dataclass
class Subscriber:
	callback: Callable
	filter: Any
	arg_count: int
	debug_key: Optional[str]
