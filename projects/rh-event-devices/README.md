# RedHouse Event Devices

An event-driven IoT device controller for Raspberry Pi peripherals. It listens for incoming sensor events over HTTP and routes them to hardware device handlers — so a single event (motion detected, temperature threshold crossed, etc.) can simultaneously trigger a buzzer melody, flash LEDs, update an OLED display, and start a camera recording.

## How It Works

Each hardware device type is implemented as a **receiver** — an abstract base class that defines a lifecycle (`init → run → cleanup`) and runs in its own thread. When a sensor event arrives via `POST /`, the event is dispatched to all receivers. Each receiver pattern-matches the event against its configured source schemas and acts if there's a match. Thread-safe state management prevents races between the dispatch thread and the receiver's own processing loop.

The camera stream recording receiver reads frames from an RTSP stream using `opencv`. The frames are put into a configurably sized circular buffer, keeping a constant history window. When a record event is received, the "pre buffer" is locked and a new buffer is created that holds the live frames. A timer is created to stop recording after a set amount of time. If more events come in while recording, the timer is reset. When the timer triggers, the buffers are joined with 1 second of blank frames between, so the viewer knows when the event happened. The result is saved to disk.

## Challenges

Managing the OLED displays in a properly configurable way was difficult. Since the OLEDs are small, I had to implement "pages" that would cycle in a loop, have each page be fully configurable, have the values change depending on the received events, include event timeouts, animations, etc. Processing all of that on a small device was taking too much CPU and the solution had to be carefully built so as to be maintainable, fast, and reliable.

## Receiver Types
- **Buzzer** — plays tonal or non-tonal melodies with configurable cooldowns to prevent rapid repeat triggers
- **LED** — simple blink control with configurable on/off durations and repeat counts
- **Pixels** — RGB LED strip animations (Neopixel/DotStar) supporting static color, blink sequences, and a day-fade mode that interpolates color and brightness based on time of day or ambient brightness
- **OLED Display** — multi-screen UI renderer with text templating, image display, scroll/swim animations, and auto-rotation between screens
- **Camera Stream** — RTSP recorder with a continuous pre-buffer ring so recordings include footage from before the trigger; sends webhook notifications (START/EXTEND/STOP) to external URLs

## Tech Stack

- **Python** — utilizing the internal framework `rhpy` from the project `redhouse-platform` included in this portfolio
- **Adafruit CircuitPython** — Neopixel and DotStar LED strips
- **luma-oled** — SSD1306/SH1106 OLED displays
- **OpenCV** — RTSP stream capture and video recording
- **Pillow** — image rendering for the OLED pipeline
