# MediaMTX Platform

A full-stack camera streaming and management platform built on top of the [MediaMTX](https://github.com/bluenviron/mediamtx) open-source media server. It provides a mediamtx.yml configuration builder, which supports generating `ffmpeg` commands to perform common stream changes such as framerate and size. It also creates a browser-based UI for viewing and controlling the live camera feeds with a polished UX.

## How It Works

The Python backend dynamically generates a `mediamtx.yml` config from a config.json, then launches MediaMTX. `ffmpeg` pipelines are dynamically generated based on the camera config. For cameras with ML detection enabled, FFmpeg pipes raw frames to an image detector process and back, producing an annotated output stream — without needing a separate pipeline definition. All `ffmpeg` pipelines also have a health monitor attached, that tracks how many frames have been sent and kills the pipeline if it becomes stuck.

A separate service serves a React frontend that connects to each stream via WebRTC or MJPEG in a grid pattern. WebRTC is handled by a custom class (not a library) with full codec negotiation for H.264/VP8/VP9/AV1. The camera grid is draggable and resizable via `react-grid-layout`, with positions and settings persisted to `localStorage`. If the camera has servos attached, they can be triggered from the UI.

## Challenges

- **ffmpeg pipeline** — making the ffmpeg pipeline builder flexible and fast for a variety of cameras and streams
- **ffmpeg stuck management** — ensuring the ffmpeg pipeline is still producing frames, especially for fickle USB cameras
- **ffmpeg to image detector sockets** — creating the pipeline and scripts needed to modify a stream with detection bboxes as fast as possible
- **browser support** — the many quirks of the various browsers on different platforms and screen sizes and codec support

## Tech Stack

### Frontend

- **React + TypeScript** — component UI
- **Vite** — build tool
- **Material UI** — component library
- **react-grid-layout** — draggable/resizable camera grid

#### Frontend Camera Controls
- Brightness adjustment
- Servo rotation, pan, tilt, and shutter (via project `rh-servos`)
- Local video recording with download
- Real-time stats (FPS, bitrate, viewer count)
- Full-screen and Picture-in-Picture

### Backend
- **Python** — build mediamtx.yml and socket bridge between image detectors and mediamtx
- **FFmpeg** — video encoding, scaling, overlays, detection pipeline
- **MediaMTX** — RTSP/WebRTC/HLS/MJPEG media server
