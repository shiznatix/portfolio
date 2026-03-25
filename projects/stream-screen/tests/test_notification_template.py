import pytest
from templates import TemplateParser, Parts

class TestTemplateParser:
	def test_empty(self):
		result = TemplateParser('').format()
		
		assert isinstance(result, Parts)
		assert result.parts == []

	def test_var_sub(self):
		result = TemplateParser('Hello, {name} {name:upper=true}!').format(name='World')
		
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Hello, World WORLD!'
	
	def test_split(self):
		parser = TemplateParser(
			'{:size=32,color=yellow}{temp[0]}{:size=20,color=red}.{temp[1]:default=0,max=9,min=0}°',
			temp=['temperature', 'split', '.']
		)
		
		result = parser.format(temperature=10)
		assert isinstance(result, Parts)
		assert len(result.parts) == 4
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].size == 32
		assert result.parts[0].color == 'yellow'
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == '10'
		assert isinstance(result.parts[2], Parts.TextProps)
		assert result.parts[2].size == 20
		assert result.parts[2].color == 'red'
		assert isinstance(result.parts[3], Parts.Text)
		assert result.parts[3].text == '.0°'
		
		result = parser.format(temperature=11.5)
		assert isinstance(result, Parts)
		assert len(result.parts) == 4
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].size == 32
		assert result.parts[0].color == 'yellow'
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == '11'
		assert isinstance(result.parts[2], Parts.TextProps)
		assert result.parts[2].size == 20
		assert result.parts[2].color == 'red'
		assert isinstance(result.parts[3], Parts.Text)
		assert result.parts[3].text == '.5°'
		
		result = parser.format(temperature=11.98)
		assert isinstance(result, Parts)
		assert len(result.parts) == 4
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].size == 32
		assert result.parts[0].color == 'yellow'
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == '11'
		assert isinstance(result.parts[2], Parts.TextProps)
		assert result.parts[2].size == 20
		assert result.parts[2].color == 'red'
		assert isinstance(result.parts[3], Parts.Text)
		assert result.parts[3].text == '.9°'
		
		result = parser.format()
		assert isinstance(result, Parts)
		assert len(result.parts) == 4
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].size == 32
		assert result.parts[0].color == 'yellow'
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == ''
		assert isinstance(result.parts[2], Parts.TextProps)
		assert result.parts[2].size == 20
		assert result.parts[2].color == 'red'
		assert isinstance(result.parts[3], Parts.Text)
		assert result.parts[3].text == '.0°'
	
	
	def test_match_var_sub_replacement(self):
		parser = TemplateParser(
			'{:color={color}}{battery_percent:default=n/a}{{color}}%',
			color=['battery_percent', 'match', [
				['green', {'maximum': 100, 'minimum': 90, 'type': 'number'}],
				['yellow', {'maximum': 50, 'minimum': 21, 'type': 'number'}],
				['red', {'maximum': 20, 'minimum': 0, 'type': 'number'}],
				['white', {}]
			]],
			green='FOO',
		)
		
		result = parser.format(battery_percent=95)
		assert isinstance(result, Parts)
		assert len(result.parts) == 2
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].color == 'green'
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == '95FOO%'
		
		result = parser.format(battery_percent=70)
		assert isinstance(result, Parts)
		assert len(result.parts) == 2
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].color == 'white'
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == '70%'
		
		result = parser.format()
		assert isinstance(result, Parts)
		assert len(result.parts) == 2
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].color == 'white'
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == 'n/a%'

	def test_newline_pattern(self):
		# Test regular newline character creates LineBreak with height=0
		result = TemplateParser('Line 1\nLine 2').format()
		assert isinstance(result, Parts)
		assert len(result.parts) == 3
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Line 1'
		assert isinstance(result.parts[1], Parts.LineBreak)
		assert result.parts[1].height == 0
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == 'Line 2'
		
		# Test {:newline=HEIGHT} pattern creates LineBreak with custom height
		result = TemplateParser('Line 1{:newline=20}Line 2').format()
		assert isinstance(result, Parts)
		assert len(result.parts) == 3
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Line 1'
		assert isinstance(result.parts[1], Parts.LineBreak)
		assert result.parts[1].height == 20
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == 'Line 2'
		
		# Test mixing regular newlines with custom newlines
		result = TemplateParser('A\nB{:newline=10}C\nD').format()
		assert isinstance(result, Parts)
		assert len(result.parts) == 7
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'A'
		assert isinstance(result.parts[1], Parts.LineBreak)
		assert result.parts[1].height == 0  # Regular newline
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == 'B'
		assert isinstance(result.parts[3], Parts.LineBreak)
		assert result.parts[3].height == 10  # Custom newline
		assert isinstance(result.parts[4], Parts.Text)
		assert result.parts[4].text == 'C'
		assert isinstance(result.parts[5], Parts.LineBreak)
		assert result.parts[5].height == 0  # Regular newline
		assert isinstance(result.parts[6], Parts.Text)
		assert result.parts[6].text == 'D'

	def test_conditional_display(self):
		# Test basic conditional display - variable exists
		result = TemplateParser('Always shown{battery:if=show_battery} Optional').format(
			battery='50%', show_battery='true'
		)
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Always shown50% Optional'
		
		# Test conditional display - variable is empty/missing (should be hidden)
		result = TemplateParser('Always shown{battery:if=show_battery} Optional').format(
			battery='50%', show_battery=''
		)
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Always shown Optional'
		
		# Test conditional display - condition variable missing entirely
		result = TemplateParser('Always shown{battery:if=show_battery} Optional').format(
			battery='50%'
		)
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Always shown Optional'
		
		# Test conditional with text formatting
		result = TemplateParser('{:color=red}{status:upper=true,if=show_status}').format(
			status='online', show_status='yes'
		)
		assert isinstance(result, Parts)
		assert len(result.parts) == 2
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].color == 'red'
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == 'ONLINE'
		
		# Test conditional with text formatting - hidden
		result = TemplateParser('{:color=red}{status:upper=true,if=show_status}').format(
			status='online', show_status=''
		)
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].color == 'red'
		
		# Test conditional with split variables
		parser = TemplateParser(
			'{temp[0]:if=show_temp}.{temp[1]:if=show_temp}°',
			temp=['temperature', 'split', '.']
		)
		
		result = parser.format(temperature='25.7', show_temp='true')
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == '25.7°'
		
		result = parser.format(temperature='25.7', show_temp='')
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == '.°'

	def test_none_handling(self):
		# Test that None values are now skipped (don't create Parts.Text entries)
		result = TemplateParser('Before{none_var}After').format(none_var=None)
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'BeforeAfter'  # None is skipped
		
		# Test with conditional that results in empty (should not add None text)
		result = TemplateParser('Before{value:if=show}After').format(value='test', show='')
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'BeforeAfter'
		
		# Test with formatting that might produce None
		result = TemplateParser('{:color=red}{value:if=show}').format(value='test', show='')
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].color == 'red'

	def test_conditional_newline(self):
		# Test conditional newline - should be visible
		result = TemplateParser('Before{:newline=20,if=show}After').format(show='yes')
		assert isinstance(result, Parts)
		assert len(result.parts) == 3
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Before'
		assert isinstance(result.parts[1], Parts.LineBreak)
		assert result.parts[1].height == 20
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == 'After'
		
		# Test conditional newline - should be hidden
		result = TemplateParser('Before{:newline=20,if=show}After').format(show='')
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'BeforeAfter'
		
		# Test conditional text properties - should be visible
		result = TemplateParser('Text{:color=red,if=show}More').format(show='yes')
		assert isinstance(result, Parts)
		assert len(result.parts) == 3
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Text'
		assert isinstance(result.parts[1], Parts.TextProps)
		assert result.parts[1].color == 'red'
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == 'More'
		
		# Test conditional text properties - should be hidden
		result = TemplateParser('Text{:color=red,if=show}More').format(show='')
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'TextMore'

	def test_embedded_vs_standalone_props(self):
		# Test variable-bound modifiers - props should be embedded in Text
		result = TemplateParser('Hello {name:color=red}!').format(name='World')
		assert isinstance(result, Parts)
		assert len(result.parts) == 3
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Hello '
		assert result.parts[0].props is None
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == 'World'
		assert result.parts[1].props is not None
		assert result.parts[1].props.color == 'red'
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == '!'
		assert result.parts[2].props is None
		
		# Test standalone modifiers - should create separate TextProps entry
		result = TemplateParser('Hello {:color=red}World!').format()
		assert isinstance(result, Parts)
		assert len(result.parts) == 3
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Hello '
		assert result.parts[0].props is None
		assert isinstance(result.parts[1], Parts.TextProps)
		assert result.parts[1].color == 'red'
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == 'World!'
		assert result.parts[2].props is None
		
		# Test mixed scenario - both variable-bound and standalone
		result = TemplateParser('{:size=20}Header: {title:color=blue}').format(title='My Title')
		assert isinstance(result, Parts)
		assert len(result.parts) == 3
		assert isinstance(result.parts[0], Parts.TextProps)
		assert result.parts[0].size == 20
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == 'Header: '
		assert result.parts[1].props is None
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == 'My Title'
		assert result.parts[2].props is not None
		assert result.parts[2].props.color == 'blue'
		
		# Test variable-bound with newlines
		result = TemplateParser('Line1\n{text:color=green}').format(text='Line2')
		assert isinstance(result, Parts)
		assert len(result.parts) == 4
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Line1'
		assert result.parts[0].props is None
		assert isinstance(result.parts[1], Parts.LineBreak)
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == ''
		assert result.parts[2].props is None
		assert isinstance(result.parts[3], Parts.Text)
		assert result.parts[3].text == 'Line2'
		assert result.parts[3].props is not None
		assert result.parts[3].props.color == 'green'

	def test_none_variable_skipping(self):
		# Test that None variables are skipped (not converted to "None" string)
		result = TemplateParser('Before{none_var}After').format(none_var=None)
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'BeforeAfter'
		
		# Test that None variables with modifiers are also skipped
		result = TemplateParser('Start{none_var:color=red}End').format(none_var=None)
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'StartEnd'
		
		# Test that None variables with default values use the default
		result = TemplateParser('Hello {none_var:default=World}!').format(none_var=None)
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Hello World!'
		assert result.parts[0].props is None
		
		# Test that None variables with default and modifiers work
		result = TemplateParser('Hello {none_var:default=World,color=blue}!').format(none_var=None)
		assert isinstance(result, Parts)
		assert len(result.parts) == 3
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Hello '
		assert isinstance(result.parts[1], Parts.Text)
		assert result.parts[1].text == 'World'
		assert result.parts[1].props is not None
		assert result.parts[1].props.color == 'blue'
		assert isinstance(result.parts[2], Parts.Text)
		assert result.parts[2].text == '!'
		
		# Test mixed scenario with some None and some valid variables
		result = TemplateParser('{valid} {none_var} {another:default=OK}').format(
			valid='Hello', none_var=None, another=None
		)
		assert isinstance(result, Parts)
		assert len(result.parts) == 1
		assert isinstance(result.parts[0], Parts.Text)
		assert result.parts[0].text == 'Hello  OK'
