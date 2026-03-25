# Stream Screen

A GStreamer-based video display service for rendering live RTSP camera streams to a physical screen (SPI TFT, framebuffer, or KMS/DRM). It composites multiple overlay layers — bounding boxes, on-screen notifications, stream status, and menus — directly onto the video output in real time, without modifying the source stream.

## How It Works

The core is a GStreamer pipeline built programmatically at startup: a `compositor` element merges the active RTSP stream with a Cairo-rendered overlay layer, then passes through `videorate`, `videoflip`, `videoconvert`, and a leaky queue before reaching the screen sink. The queue is configured to drop old buffers, ensuring display lag never accumulates.

Each RTSP stream is managed as a `RtspStream` — a GStreamer `Bin` with its own `src`, `flip`, `balance`, and `convert` chain. Streams can be hot-swapped: the active stream is linked into the compositor while inactive ones remain disconnected but optionally pre-connected for instant switching. Brightness and contrast are adjustable per-stream via GStreamer's `videobalance` element, and settings are persisted to disk with debounce.

Overlay content is rendered with **Cairo** into a double-buffered ARGB surface and composited at `zorder=2` above the video. Each overlay type is a separate class that subscribes to internal events and redraws only when its data changes:

- **Detections** — draws bounding boxes and confidence scores from Redis-sourced detection events
- **Notifications** — renders templated text in the top-right corner with configurable blink, timeout, and value states
- **Stream status** — shows RTSP connection state
- **Timestamp** — current time display
- **Menu / stream name** — active stream label and navigation menu

Sensor events arrive via `POST /` or Redis pub/sub. Events are pattern-matched against configured schemas and dispatched to the internal event bus, which drives overlay updates, stream switching, and pause/resume.

A **splash screen** system renders PIL images directly to the SPI TFT or framebuffer for startup, shutdown, and error states — outside the GStreamer pipeline entirely.

## Supported Screen Types

- **SPI TFT** — ST7789 via custom SPI driver
- **Framebuffer** — writes directly to `/dev/fb*`
- **KMS/DRM** — via GStreamer `kmssink`

## Tech Stack

- **Python** — utilizing the internal framework `rhpy` from the project `redhouse-platform` included in this portfolio
- **GStreamer** — video pipeline, compositing, and screen output
- **Cairo** — 2D overlay rendering (bounding boxes, text, animations)
- **Pillow** — splash screen rendering
- **Redis** — pub/sub for detection events and sensor input
- **OpenCV / NumPy** — framebuffer output path
