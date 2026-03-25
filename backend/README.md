# Backend

A collection of Python and Go microservices that form the Redhouse home automation platform. Services communicate via HTTP webhooks and Redis pub/sub, all built on the shared `rhpy` internal framework.

## Services

### [Crazy Clock](../projects/crayclk/README.md)
Drives a 7-segment LED display that shows the real time when someone is nearby and switches to impossible or random times when no one is watching. Receives face detection events and light readings over HTTP.

### [rh-event-devices](../projects/rh-event-devices/README.md)
Routes incoming sensor events to hardware output devices — buzzers, LEDs, RGB LED strips, OLED displays, and RTSP cameras. Each device type runs as a separate receiver thread with pattern-matched event dispatch.

### [rh-image-detector](../projects/rh-image-detector/README.md)
Real-time computer vision service that accepts raw video frames over sockets and runs them through configurable detection models (MediaPipe, BlazeFace, YOLO v5). Publishes detection events to Redis and HTTP webhooks.

### [rh-sensors](../projects/rh-sensors/README.md)
Polls 23+ hardware sensor types simultaneously (distance, temperature, motion, gesture, air quality, power, and more), publishing readings to HTTP endpoints, Redis, and Prometheus.

### [web-scraper](../projects/web-scraper/README.md)
REST API scraping service supporting plain HTTP and Firefox browser automation via Marionette. Includes anti-detection measures and a specialized IMDB extractor that recursively pulls all seasons and episodes.

### [VLR](../projects/vlr/README.md)
Go media server handling VLC playback control, TV show library management with IMDB metadata, automatic torrent downloading via Transmission, and TV control via HDMI-CEC.

### [Piper Voice](../projects/piper-voice/README.md)
Text-to-speech service powered by Piper TTS with a smart PDF text extractor and REST API for synthesis requests.

## Shared Infrastructure

All Python services are built on **`rhpy`** — an internal async web framework providing HTTP routing with Pydantic validation, a Redis client with pub/sub, thread/timer utilities, structured logging, and graceful shutdown handling. See [redhouse-platform](../projects/redhouse-platform/README.md) for details.
