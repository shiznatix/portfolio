from typing import Literal

from rich.table import Table
from rich.text import Text

Align = Literal['left', 'center', 'right']
RowElements = tuple[list[list[Text]], list[Table]]
TableSections = list[RowElements]

__all__ = ['Align', 'RowElements', 'TableSections']
