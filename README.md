# Portfolio

A collection of personal projects spanning home automation, IoT, media, and developer tooling. Most are production services running on a small home lab of Raspberry Pis and a local server. This portfolio does not include all of my projects, but is curated to showcase unique technologies and workflows that I use.

---

## Projects

### [Redhouse Platform](projects/redhouse-platform/README.md)
A shared platform monorepo providing reusable libraries and tooling for my custom "Redhouse" microservice ecosystem. Rather than duplicating boilerplate across services, each project pulls in what it needs from here. The `rhpy` Python library contains a lightweight async web framework built on Starlette/Pydantic, and a suite of Node.js packages (`@rh/react`, `@rh/tsconfig`, `@rh/vite`, `@rh/eslint-config`) used by all frontend services.

### [Manage Machines](projects/manage-machines/README.md)
A TypeScript CLI tool (`mm`) for managing 50+ services across multiple machines — installing, configuring, syncing, and controlling them with a single consistent interface. Built on a mixin-based service factory with decorator-driven actions and shell completion.

### [MediaMTX](projects/mediamtx/README.md)
Full-stack camera streaming platform built on the MediaMTX media server. Python backend dynamically generates camera configs and builds FFmpeg pipelines (including an ML detection pipeline). React frontend connects via a custom WebRTC/WHEP implementation with a draggable, resizable camera grid.

### [RedHouse Image Detector](projects/rh-image-detector/README.md)
Real-time computer vision service that processes video frames over raw sockets, running them through configurable detection models (MediaPipe, BlazeFace, YOLO). Publishes detection events to Redis and HTTP webhooks with debounce and state-change logic.

### [RedHouse Sensors](projects/rh-sensors/README.md)
Sensor aggregation service for Raspberry Pi supporting 20+ hardware sensor types (temperature, motion, distance, gesture, air quality, power, and more). Each sensor runs in its own thread and publishes readings to HTTP endpoints, Redis, and Prometheus.

### [RedHouse Event Devices](projects/rh-event-devices/README.md)
Event-driven IoT device controller that reacts to sensor events by triggering hardware outputs — buzzer melodies, LED blinks, RGB LED strip animations, OLED display updates, and RTSP camera recordings with pre-event ring-buffer capture.

### [Stream Screen](projects/stream-screen/README.md)
GStreamer-based video display service for rendering live RTSP streams to a physical screen (SPI TFT, framebuffer, or KMS/DRM). Composites Cairo-rendered overlay layers — bounding boxes, notifications, stream status, and menus — directly onto the video output without modifying the source stream. Supports hot-swappable streams and is driven by sensor events via HTTP and Redis.

### [Piper Voice](projects/piper-voice/README.md)
Full-stack text-to-speech web app powered by Piper TTS. Includes a smart PDF-to-text extractor that analyzes font sizes and styles to identify headings, lists, and code blocks before synthesis. React frontend with voice parameter sliders, format selection, and persistent synthesis history.

### [Crazy Clock](projects/crayclk/README.md)
Smart 7-segment LED clock running on a Raspberry Pi that shows the correct time when faces are detected nearby — and displays impossible or random times when no one is watching. Brightness adjusts automatically via an ambient light sensor.

### [VLR (VLC Remote)](projects/vlr/README.md)
Web-based remote control for VLC media player with TV show library management, automatic torrent downloading via Transmission, and TV control via HDMI-CEC. Go backend serves a compiled React bundle as a single self-contained binary.

### [Web Scraper](projects/web-scraper/README.md)
REST API scraping service supporting both plain HTTP and Firefox browser automation via the Marionette protocol. Includes anti-detection measures (user-agent rotation, window randomization, `navigator.webdriver` masking) and a specialized IMDB extractor that recursively pulls all seasons and episodes.

### [Home Bin](projects/home-bin/README.md)
Personal Linux command dispatcher (`qq`) organizing 14 categories of custom shell utilities — encryption, filesystem tools, git shortcuts, GPU monitoring, Raspberry Pi management, Python/Node tooling, and more. Includes `monnom`, a Rich-based terminal system monitoring dashboard.
