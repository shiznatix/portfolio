# Crazy Clock

A clock that tells the correct time when someone is actively looking at it, but shows something impossible or crazy when nobody is looking. When you look at it from the corner of your eye, it shows something very strange. But when you turn to look at it, it switches quickly to the correct time.

## Display modes (when no face is detected)

- `impossible` — shows nonsensical times like `37:84`
- `random` — scrolls random digits with occasional decimal points
- `off` — turns off the display entirely

## Service Stack

The entire stack was developed to run solely on a Raspberry Pi Zero 2W.

The stack consists of five cooperating services:
- `crayclk` — controls the LED clock and changes the "mode" based on signals from `rh-image-detector`
- `mediamtx` — reads the picam and publishes to an RTSP stream
- `rh-image-detector` — reads the RTSP stream and sends the frames to the face detector model. Detections are converted to a bbox and sent to Redis and directly to `crayclk` service via HTTP.
- `stream-screen` — Displays the original RTSP stream to a screen, and overlays the detected bboxes onto the output. Listens to Redis for bbox data.
- `rh-sensors` — Reads a photoresistor to detect ambient light levels and sends that to `crayclk`, so that the LED clock can change its brightness accordingly. Otherwise the clock is blinding at night and unreadable during the day.

## How It Works

The picam stream is read by `rh-image-detector` and by `stream-screen`. Faces are detected using `mediapipe` directly on the Pi Zero 2W, and results are published to Redis every 0.2 seconds, and to the main `crayclk` service via HTTP every 0.5 seconds. `stream-screen` combines the video stream and the latest results from Redis into 1 image using `gstreamer`, and outputs this to a TFT display.

The full pipeline runs within ~50% CPU and 230 MB RAM on a Pi Zero 2W, with ~100ms end-to-end latency.

## Challenges

Getting the stream with the detection overlays latency down to an acceptable level took a while. I tried many different ffmpeg and gstreamer ideas that would draw the bboxes onto the frames and then display those frames on the display. I could never get it below about 500ms, and it was very noticeable. I ended up sending the un-processed stream directly to the display, and used Redis as a pub/sub for the bboxes, and then used gstreamer to make a composite pipeline to put the bboxes on top of the stream. The result is a near real-time display with the bboxes lagging only by ~200ms.

The `rh-image-detector` service proved challenging as well. Finding a properly documented pipeline for face detection that worked on the hardware, and implementing it correctly, took a lot of trial and error. I landed on `mediapipe` version `0.10.18` which is the latest version with python wheels for the aarch64. Additionally I initially was reading the frames from mediamtx using a unix socket, and sending the frames with the bboxes back. The returned frames were then sent to the MediaMTX path as another stream, which I then displayed on the screen. This proved quite stable but the lag was too much (~500ms). The Redis bbox pub/sub strategy won out, as it was not only faster but the small lag on the bbox drawing isn't an issue when the main stream is near real-time.

## Tech Stack
- **Python** — main service language
- **MediaMTX** — Video streaming server; publishes the PiCam feed for downstream services to consume
- **GStreamer** — video pipeline (overlay + TFT output)
- **MediaPipe** — face detection model (on-device, CPU only)
- **Redis** — pub/sub for detection bbox communication
- **Raspberry Pi Zero 2W** — target hardware
- **TFT display / PiCam** — peripherals
