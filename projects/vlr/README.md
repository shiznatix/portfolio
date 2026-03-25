# VLR (VLC Remote)

A web-based remote control and media management application for VLC media player. It combines playback control, TV show library management, automatic torrent downloading, and TV control via HDMI-CEC into a single self-contained binary.

## How It Works

The Go backend serves a compiled React bundle and exposes a REST API covering all media center operations. Key modules run as independent services coordinated through Go contexts for graceful shutdown:

- **VLC control** — communicates with VLC's HTTP API (play, pause, seek, volume, audio/subtitle track selection, playlist management with drag-and-drop reordering)
- **Episode management** — scans configured filesystem directories for TV show episodes and cross-references them against IMDB metadata (fetched via web scraping) to identify what's missing
- **Auto-download** — integrates with Transmission to automatically queue missing episodes as torrents
- **HDMI-CEC** — controls TV power and volume via libcec
- **File browser** — navigate and play files from configured media directories
- **Random playback** — slot-based weighted randomization that balances selection across configured show categories

Episode metadata (watch count, skip flags, download markers) is stored as extended filesystem attributes (xattr) directly on the files rather than in a separate database. A generic caching layer persists JSON snapshots to disk and syncs on configurable intervals. For multi-instance deployments, a master-server pattern coordinates shared resources.

## Challenges

The most noteworthy was the database of individual file play count, last play time, etc. I wanted the values to not be lost during file copy or renaming. The xattr solution worked the best for this since it's part of the file itself.

## Tech Stack

### Backend
- **Go** — HTTP server (Gorilla Mux), all backend modules
- **go-vlc-ctrl** — VLC HTTP API client
- **goquery** — IMDB web scraping
- **libcec** — HDMI-CEC TV control
- **pkg/xattr** — filesystem extended attributes

### Frontend
- **React + TypeScript** — UI
- **Material UI** — component library
- **Zustand** — state management
- **@dnd-kit** — drag-and-drop playlist reordering
- **react-window** — virtualized list rendering
- **Webpack** — build tool
