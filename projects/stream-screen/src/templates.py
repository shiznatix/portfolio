from __future__ import annotations
from dataclasses import dataclass
import re

import rhpy

class Parts:
	@dataclass
	class Part:
		pass
	@dataclass
	class TextProps(Part):
		color: str | None = None
		size: int | None = None
		# align: Literal['top', 'bottom'] | None = None
		def __str__(self):
			return f'TParts.TextProps(color={self.color}, size={self.size})'
	@dataclass
	class Text(Part):
		text: str
		props: Parts.TextProps | None = None
		def __post_init__(self):
			if not isinstance(self.text, str):
				raise ValueError('Parts.Text.text must be a string')
		def __str__(self):
			return f'TParts.Text({self.props}): {self.text}'
	@dataclass
	class LineBreak(Part):
		height: int = 0
		def __str__(self):
			return f'TParts.LineBreak(height={self.height})'

	def __init__(self, template: str, parts: list[Parts.Part]):
		self.template = template
		self.parts = parts
	def __str__(self):
		parts = '\n'.join(f'  {part}' for part in self.parts)
		return f'TParts({len(self.parts)}):\n{parts}'
	def __iter__(self):
		return iter(self.parts)

	def extend(self, other: 'Parts'):
		self.parts.extend(other.parts)

	def to_lines(self):
		lines: list[Lines.Text | Lines.Break] = []
		line_parts: list[Parts.Text | Parts.TextProps] = []
		for part in self.parts:
			if isinstance(part, Parts.LineBreak):
				if line_parts:
					lines.append(Lines.Text(parts=line_parts))
				lines.append(Lines.Break(height=part.height))
				line_parts = []
			elif isinstance(part, (Parts.Text, Parts.TextProps)):
				line_parts.append(part)
		if line_parts:
			lines.append(Lines.Text(parts=line_parts))
		return Lines(lines=lines)

@dataclass
class Lines:
	@dataclass
	class Line:
		pass
	@dataclass
	class Break(Line):
		height: int
	@dataclass
	class Text(Line):
		parts: list[Parts.Text | Parts.TextProps]
		def __iter__(self):
			return iter(self.parts)

	lines: list[Text | Break]
	def __iter__(self):
		return iter(self.lines)

class TemplateParser:
	# Matches either {:modifiers} or {var[index]:modifiers} or {var[index]} or {var:modifiers}
	pattern = re.compile(r'{([^:{}]*)(?::([^{}]+))?}')
	# Matches double braces for dynamic variable names {{varname}}
	double_brace_pattern = re.compile(r'{{([^{}]+)}}')

	def __init__(self, template, **variables):
		self.template = template
		self.split_vars = {}
		self.match_vars = {}
		self.static_vars = {}
		for name, val in variables.items():
			if isinstance(val, (tuple, list)) and len(val) == 3:
				if val[1] == 'split':
					self.split_vars[name] = (val[0], val[2])  # (source_var, delimiter)
				elif val[1] == 'match':
					self.match_vars[name] = (val[0], val[2])  # (source_var, [[value, schema], ...])
				else:
					raise ValueError(f'Unsupported var action: {val[1]}')
			else:
				# Regular static variable
				self.static_vars[name] = val

	def _split_text_with_linebreaks_with_props(self, text, props):
		if text is None:
			return []

		# Convert to string if not already
		text = str(text)

		if '\n' not in text:
			if text:  # Only create Parts.Text if text is not empty
				return [Parts.Text(text, props)]
			else:
				return [Parts.Text(text, props)]  # Even empty strings should create Text parts

		parts = []
		lines = text.split('\n')
		for i, line in enumerate(lines):
			if i > 0:  # Add line break before each line except the first
				parts.append(Parts.LineBreak())
			# Always add text part with props, even for empty lines
			parts.append(Parts.Text(line, props))
		return parts

	def _split_text_with_linebreaks(self, text):
		if text is None:
			return []

		# Convert to string if not already
		text = str(text)

		if '\n' not in text:
			if text:  # Only create Parts.Text if text is not empty
				return [Parts.Text(text)]
			else:
				return [Parts.Text(text)]  # Even empty strings should create Text parts

		parts = []
		lines = text.split('\n')
		for i, line in enumerate(lines):
			if i > 0:  # Add line break before each line except the first
				parts.append(Parts.LineBreak())
			# Always add text part, even for empty lines
			parts.append(Parts.Text(line))
		return parts

	def _apply_modifiers(self, val, opts, all_vars=None, embed_props=False):
		# Skip creating Parts.Text if the original value is literally None
		if val is None and 'default' not in opts:
			return []

		# Check conditional display first - if condition fails, return empty
		if 'if' in opts and all_vars is not None:
			condition_var = opts['if']
			condition_value = all_vars.get(condition_var, '')
			# If condition variable is empty/None/falsy, don't display this block
			if not condition_value or condition_value == '':
				return []

		text = str(val)

		# Apply default first if value is empty
		if 'default' in opts and (val is None or val == ''):
			val = opts['default'].strip('"').strip("'")
			text = str(val)

		# Numeric coercions
		if 'min' in opts:
			float_val = max(float(val), float(opts['min']))
			# Keep as integer if it's a whole number
			if float_val == int(float_val):
				val = str(int(float_val))
			else:
				val = str(float_val)
			text = val
		if 'max' in opts:
			float_val = min(float(val), float(opts['max']))
			# Keep as integer if it's a whole number
			if float_val == int(float_val):
				val = str(int(float_val))
			else:
				val = str(float_val)
			text = val

		# Handle size and other config options
		has_config_opts = 'size' in opts or 'color' in opts or 'align' in opts
		config_opts = {}

		# Text transformations
		if 'replace' in opts:
			old_new = opts['replace'].split('|', 1)
			if len(old_new) == 2:
				old, new = old_new
				val = str(val).replace(old, new)
				text = val
		if opts.get('upper') == 'true':
			val = str(val).upper()
			text = val
		if opts.get('lower') == 'true':
			val = str(val).lower()
			text = val
		if opts.get('strip') == 'true':
			val = str(val).strip()
			text = val

		# Collect config options
		for k, v in opts.items():
			if k == 'size':
				config_opts['size'] = int(v)
				has_config_opts = True
			elif k == 'color':
				config_opts['color'] = v
				has_config_opts = True
			elif k == 'align':
				config_opts['align'] = v
				has_config_opts = True

		# Return appropriate type based on whether there are config options and embed_props flag
		if has_config_opts:
			if embed_props:
				# Embed props in Text instances for variable-bound modifiers
				props = Parts.TextProps(**config_opts)
				if text and text is not None:
					text_parts = self._split_text_with_linebreaks_with_props(text, props)
					return text_parts
				else:
					return []
			else:
				# Return separate config and text items for standalone modifiers
				config = Parts.TextProps(**config_opts)
				if text and text is not None:
					text_parts = self._split_text_with_linebreaks(text)
					return [config] + text_parts
				else:
					return [config]
		else:
			return self._split_text_with_linebreaks(text)

	def format(self, **kwargs):
		parts = self._format_recursive(self.template, kwargs, max_depth=10)
		return Parts(self.template, parts)

	def _format_recursive(self, template, kwargs, max_depth=10):
		if max_depth <= 0:
			# Prevent infinite recursion
			return self._split_text_with_linebreaks(template)

		all_vars = dict(kwargs)
		# Add static variables
		all_vars.update(self.static_vars)

		# --- Precompute split variables ---
		for name, (source_var, delim) in self.split_vars.items():
			if source_var in all_vars:
				all_vars[name] = str(all_vars[source_var]).split(delim)

		# --- Precompute match variables ---
		for name, (source_var, options) in self.match_vars.items():
			value = all_vars.get(source_var, None)
			matched = None
			for candidate_value, schema in options:
				if rhpy.matches_schema(value, schema)[0]:
					matched = candidate_value
					break
			if matched is None and options:
				# fallback: use the last option's value
				matched = options[-1][0]
			all_vars[name] = matched

		# --- Main replacement loop ---
		has_substitutions = False
		result = []
		pos = 0

		for match in self.pattern.finditer(template):
			start, end = match.span()
			if start > pos:
				result.extend(self._split_text_with_linebreaks(template[pos:start]))

			var = match.group(1)
			options = match.group(2)
			opts = {}
			if options:
				for part in options.split(','):
					if '=' in part:
						k, v = part.split('=', 1)
						opts[k.strip()] = v.strip()

			if var == '':
				# Standalone modifiers - check conditional first
				if 'if' in opts:
					condition_var = opts['if']
					condition_value = all_vars.get(condition_var, '')
					# If condition variable is empty/None/falsy, don't display this block
					if not condition_value or condition_value == '':
						pass  # Skip this block entirely
					else:
						# Condition passed, process the modifier
						if 'linebreak' in opts:
							# Handle {:linebreak=HEIGHT} pattern
							height = int(opts['linebreak'])
							result.append(Parts.LineBreak(height=height))
						else:
							# Regular text properties
							props = Parts.TextProps()
							for k, v in opts.items():
								if k == 'color':
									props.color = v
								elif k == 'size':
									props.size = int(v)
							result.append(props)
				else:
					# No conditional, process normally
					if 'linebreak' in opts:
						# Handle {:linebreak=HEIGHT} pattern
						height = int(opts['linebreak'])
						result.append(Parts.LineBreak(height=height))
					else:
						# Regular text properties
						props = Parts.TextProps()
						for k, v in opts.items():
							if k == 'color':
								props.color = v
							elif k == 'size':
								props.size = int(v)
						result.append(props)
			else:
				# Regular variables (split/index/normal)
				split_ref = re.match(r'(\w+)\[(\d+)\]', var)
				if split_ref:
					base, idx = split_ref.groups()
					idx = int(idx)
					if base in all_vars and isinstance(all_vars[base], list):
						if idx < len(all_vars[base]):
							val = all_vars[base][idx]
						else:
							val = opts.get('default', '')
						result.extend(self._apply_modifiers(val, opts, all_vars, embed_props=True))
					else:
						# Split variable doesn't exist, use default
						val = opts.get('default', '')
						result.extend(self._apply_modifiers(val, opts, all_vars, embed_props=True))
				else:
					val = all_vars.get(var, opts.get('default', ''))
					if opts:
						result.extend(self._apply_modifiers(val, opts, all_vars, embed_props=True))
					else:
						# Skip creating Parts.Text if the value is literally None
						if val is not None:
							result.extend(self._split_text_with_linebreaks(str(val)))

				has_substitutions = True

			pos = end
		if pos < len(template):
			result.extend(self._split_text_with_linebreaks(template[pos:]))

		# Merge consecutive Text objects
		merged = []
		for item in result:
			if (merged and
				isinstance(merged[-1], Parts.Text) and
				isinstance(item, Parts.Text)):
				# Only merge text objects if they have compatible props
				# For now, only merge if both have None props or the same props
				last_props = merged[-1].props
				item_props = item.props

				if last_props is None and item_props is None:
					# Both have no props, safe to merge
					if merged[-1].text is not None and item.text is not None:
						merged[-1] = Parts.Text(merged[-1].text + item.text)
					elif merged[-1].text is None and item.text is not None:
						merged[-1] = Parts.Text(item.text)
					# If item.text is None, keep the existing merged[-1]
				else:
					# Don't merge text objects with different props
					if not (isinstance(item, Parts.Text) and item.text is None):
						merged.append(item)
			else:
				# Only add item if it's not a Text with None value
				if not (isinstance(item, Parts.Text) and item.text is None):
					merged.append(item)

		# If we made substitutions OR there are double braces, recursively process any strings
		contains_double_braces = any(isinstance(item, Parts.Text) and '{{' in item.text for item in merged)
		if has_substitutions or contains_double_braces:
			final_result = []
			for item in merged:
				if isinstance(item, Parts.Text) and ('{' in item.text):
					# Check for double braces first
					if '{{' in item.text:
						# Process double braces for dynamic variable names
						temp_result = []
						pos = 0
						for match in self.double_brace_pattern.finditer(item.text):
							start, end = match.span()
							if start > pos:
								temp_result.append(item.text[pos:start])

							var_name = match.group(1)
							# Get the variable value to use as the new variable name
							dynamic_var_name = all_vars.get(var_name, var_name)
							# Get the value of that dynamic variable
							dynamic_value = all_vars.get(dynamic_var_name, '')
							temp_result.append(str(dynamic_value))
							pos = end

						if pos < len(item.text):
							temp_result.append(item.text[pos:])

						# Join the result to form the new string
						processed_text = ''.join(temp_result)
						# Handle linebreaks in the processed text
						text_parts = self._split_text_with_linebreaks(processed_text)
						if len(text_parts) == 1:
							item = text_parts[0]
						else:
							# Multiple parts (includes LineBreaks), add them all
							final_result.extend(text_parts)
							continue

					# Now check if there are still single braces to process
					if '{' in item.text and not '{{' in item.text:
						# Recursively process this string
						recursive_result = self._format_recursive(item.text, all_vars, max_depth - 1)
						final_result.extend(recursive_result)
					else:
						final_result.append(item)
				else:
					final_result.append(item)
			return final_result
		else:
			return merged
