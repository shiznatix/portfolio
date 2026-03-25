from prometheus_client import Counter, Gauge

_prefix = 'rh_sensors_'
_lables = ['sensor_type', 'sensor_name', 'title']

counter_motion = Counter(f'{_prefix}event_motion', 'Motion Events', _lables)
counter_vibration = Counter(f'{_prefix}event_vibration', 'Vibration Events', _lables)
counter_loudness = Counter(f'{_prefix}event_loudness', 'Loudness Events', _lables)
counter_air_quality = Counter(f'{_prefix}event_air_quality', 'Air Quality Events', _lables)

gauge_rotary_value = Gauge(f'{_prefix}rotary_value', 'Rotary Value', _lables)
counter_rotary_press = Counter(f'{_prefix}rotary_press', 'Rotary Press', _lables)

gauge_loudness_value = Gauge(f'{_prefix}loudness_value', 'Loudness Value', _lables)
gauge_loudness_voltage = Gauge(f'{_prefix}loudness_voltage', 'Loudness Voltage', _lables)

gauge_temperature = Gauge(f'{_prefix}temperature', 'Temperature', _lables)
gauge_humidity = Gauge(f'{_prefix}humidity', 'Humidity', _lables)
gauge_pressure = Gauge(f'{_prefix}pressure', 'Pressure', _lables)
gauge_gas = Gauge(f'{_prefix}gas', 'Gas', _lables)
gauge_altitude = Gauge(f'{_prefix}altitude', 'Altitude', _lables)

gauge_air_quality_value = Gauge(f'{_prefix}air_quality_value', 'Air Quality Value', _lables)
gauge_air_quality_voltage = Gauge(f'{_prefix}air_quality_voltage', 'Air Quality Voltage', _lables)

gauge_current = Gauge(f'{_prefix}battery_value', 'Current (mA)', _lables)
gauge_bus_voltage = Gauge(f'{_prefix}battery_bus_voltage', 'Bus voltage (V)', _lables)
gauge_shunt_voltage = Gauge(f'{_prefix}battery_shunt_voltage', 'Shunt voltage (mV)', _lables)
gauge_battery_percent = Gauge(f'{_prefix}battery_percent', 'Battery Percent', _lables)

gauge_light_value = Gauge(f'{_prefix}light_value', 'Light Value', _lables)
gauge_light_voltage = Gauge(f'{_prefix}light_voltage', 'Light Voltage', _lables)
gauge_light_brightness = Gauge(f'{_prefix}light_brightness', 'Light Brightness', _lables)
gauge_light_rc_secs = Gauge(f'{_prefix}light_rc_secs', 'Light read time (seconds)', _lables)

gauge_water_drops_value = Gauge(f'{_prefix}water_drops_value', 'Water Drops Value', _lables)
gauge_water_drops_voltage = Gauge(f'{_prefix}water_drops_voltage', 'Water Drops Voltage', _lables)

gauge_soil_moisture_value = Gauge(f'{_prefix}soil_moisture_value', 'Soil Moisture Value', _lables)
gauge_soil_moisture_voltage = Gauge(f'{_prefix}soil_moisture_voltage', 'Soil Moisture Voltage', _lables)

gauge_tds_value = Gauge(f'{_prefix}total_disolved_solids_value', 'Total Disolved Solids Value', _lables)
gauge_tds_voltage = Gauge(f'{_prefix}total_disolved_solids_voltage', 'Total Disolved Solids Voltage', _lables)

gauge_uv_value = Gauge(f'{_prefix}uv_value', 'UV Value', _lables)
gauge_uv_voltage = Gauge(f'{_prefix}uv_voltage', 'UV Voltage', _lables)

gauge_wind_speed_meters_second = Gauge(f'{_prefix}wind_speed_meters_second', 'Wind Speed m/s', _lables)
gauge_wind_speed_knots = Gauge(f'{_prefix}wind_speed_knots', 'Wind Speed knots', _lables)
gauge_wind_speed_value = Gauge(f'{_prefix}wind_speed_value', 'Wind Speed Value', _lables)
gauge_wind_speed_voltage = Gauge(f'{_prefix}wind_speed_voltage', 'Wind Speed Voltage', _lables)
