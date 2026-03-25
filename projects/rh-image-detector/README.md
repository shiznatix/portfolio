# RedHouse Image Detector

A real-time computer vision service that performs object and face detection on video streams. It sits in the pipeline between a camera source and downstream consumers, processing frames and notifying other services when detections occur.

## How It Works

The service can perform detections in two ways: pushed frames over a socket, or pulled frames by reading an RTSP stream directly with `opencv`.

The socket mode uses two raw socket servers: an **input server** that accepts frames from clients, and an **output server** that streams annotated frames back. Each connection sends a JSON header describing the stream dimensions and which detection models to run, followed by raw RGB frame bytes. A thread-safe frame store with condition variables ensures output consumers wait for new frames efficiently rather than polling.

When a frame arrives, it's routed to all requested detectors. Results are aggregated and bounding boxes are drawn onto the frame before it's passed to the output stream. A separate **notifier** system publishes detection events — debounced and only on state changes — to Redis pub/sub and/or HTTP webhooks simultaneously, without blocking frame processing.

## Challenges

By far the hardest was finding a pipeline that would allow near real time frame annotation. The socket server method worked well, but the ffmpeg → mediamtx → RTSP stream became a bottleneck. The solution was to read the stream with `opencv` and publish bboxes to Redis and let the final reader combine the two. For more details, see the portfolio project `crayclk` README.md.

## Supported Detection Models
- **MediaPipe Face** — lightweight offline face detection
- **MediaPipe Objectron** — real-time object detection
- **BlazeFace** — TensorFlow Lite model suited for Raspberry Pi
- **YOLO** — general purpose object detection with GPU acceleration

## Tech Stack

- **Python** — utilizing the internal framework `rhpy` from the project `redhouse-platform` included in this portfolio
- **OpenCV** — frame handling and visualization
- **NumPy** — array operations
- **MediaPipe**, **TensorFlow Lite**, **PyTorch/YOLO** — detection backends (optional per deployment)
- **Redis** — pub/sub for detection event distribution
