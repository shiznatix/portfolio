from prometheus_client import Counter
from prometheus_client import Gauge

counter_buzzes = Counter('rh_event_devices_buzzer', 'Buzzer buzzes', ['name', 'title'])
counter_led = Counter('rh_event_devices_led', 'LED signals', ['name', 'title'])
gauge_brightness = Gauge('rh_event_devices_pixel_brightness', 'Pixel brightness', ['name', 'title'])
