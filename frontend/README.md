# Frontend

Three React + TypeScript web applications, all built on the shared [Redhouse Platform](../projects/redhouse-platform/README.md) component library (`@rh/react`, `@rh/tsconfig`, `@rh/vite`).

## Apps

### [MediaMTX Client](../projects/mediamtx/README.md)
Multi-camera streaming dashboard with a draggable, resizable grid layout (react-grid-layout). Streams via WebRTC (custom WHEP implementation) or MJPEG fallback. Supports camera servo control, local video recording, real-time stats, fullscreen, and Picture-in-Picture. Layout and settings persist to `localStorage`.

**Stack:** React + TypeScript, Vite, Material UI, react-grid-layout

---

### [Piper Voice Client](../projects/piper-voice/README.md)
Text-to-speech UI for the Piper Voice synthesizer. Supports text input or file upload (TXT/PDF), voice selection, and three synthesis parameter sliders (speed, noise, noise width). Keeps a persistent history of recent syntheses with playback controls, format switching (WAV/OGG), and one-click re-synthesis.

**Stack:** React + TypeScript, Vite, Material UI

---

### [VLR Client](../projects/vlr/README.md)
Full-featured remote control and media browser for VLC. Includes a collapsible swipe-gesture remote with playlist management (drag-and-drop reordering via @dnd-kit), subtitle/audio track dialogs, and TV CEC control. Main views cover show browsing, smart random episode selection with saved presets, torrent download management, and a filesystem episode browser. Large lists use `react-window` for virtualized rendering.

**Stack:** React + TypeScript, Webpack, MUI Joy, Zustand, @dnd-kit, react-window
