# pylint: disable=wrong-import-position,no-name-in-module
import gi
gi.require_version('Gst', '1.0')
gi.require_version('GstVideo', '1.0')
gi.require_version('GstBase', '1.0')

from gi.repository import Gst, GLib  # type: ignore[import]
import cairo
from cairo import (
	Context as CairoContext,
	ImageSurface as CairoImageSurface,
	TextExtents as CairoTextExtents,
	FORMAT_ARGB32 as CAIRO_FORMAT_ARGB32,
	FONT_SLANT_NORMAL as CAIRO_FONT_SLANT_NORMAL,
	FONT_WEIGHT_BOLD as CAIRO_FONT_WEIGHT_BOLD,
	OPERATOR_CLEAR as CAIRO_OPERATOR_CLEAR,
)

__all__ = [
	'Gst',
	'GLib',
	'cairo',
	'CairoContext',
	'CairoImageSurface',
	'CairoTextExtents',
	'CAIRO_FORMAT_ARGB32',
	'CAIRO_FONT_SLANT_NORMAL',
	'CAIRO_FONT_WEIGHT_BOLD',
	'CAIRO_OPERATOR_CLEAR',
]
