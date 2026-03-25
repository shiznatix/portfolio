# RedHouse Sensors

A unified sensor aggregation service for Raspberry Pi. It initializes and polls 20+ different hardware sensors simultaneously, publishing readings to HTTP endpoints, Redis pub/sub channels, and a Prometheus `/metrics` endpoint.

## How It Works

Each sensor runs in its own daemon thread, staggered with a random 0–5 second startup delay to avoid overloading the I2C bus or receiver URLs. Sensors follow a common lifecycle (`init → run → cleanup`) with automatic 10-second retry on failure. When a reading is ready, it's dispatched via a `ThreadPoolExecutor` using thread-local HTTP session pooling for connection reuse, or published directly to a Redis channel if the receiver URL uses the `redis://` scheme.

## Challenges

The gesture sensor was the hardest to set up, as there was limited documentation and no standard complete libraries for it. I had to piece together information from anywhere I could find to get it working consistently.

## Sensor Categories

- **Distance** — VL53L0X laser ToF (with rolling 50-sample average), HC-SR04 ultrasonic
- **Temperature / Atmospheric** — DS18B20 (1-Wire), DHT/AM2302, BME280, BME680 (temp, humidity, pressure, gas)
- **Motion** — HC-SR501 and AM312 PIR sensors (GPIO event-driven with debounce)
- **Light / Analog** — photoresistor and digital light sensors via ADS1115 ADC
- **Air quality** — MQ-135 (analog or event-driven; requires warm-up and manual calibration)
- **Power** — INA219 (voltage, current, battery %)
- **Gesture** — PAJ7620U2 (9 gestures: left/right/up/down/forward/backward/clockwise/counter-clockwise/wave)
- **Input** — KY-040 rotary encoder, buttons, touchscreen (tap/press/swipe via evdev)
- **Environmental** — soil moisture, water, UV (GUVAS12SD), wind speed, TDS water quality, vibration (SW-420)

## Tech Stack

- **Python** — utilizing the internal framework `rhpy` from the project `redhouse-platform` included in this portfolio
- **Adafruit CircuitPython** — ADS1115, BME280/680, DHT, INA219, VL53L0X
- **evdev** — touchscreen/gesture sensors
- **Redis** — publish events and values
