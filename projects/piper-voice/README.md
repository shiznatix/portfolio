# Piper Voice

A full-stack text-to-speech web application powered by [Piper TTS](https://github.com/rhasspy/piper), a neural voice synthesis engine. Users can synthesize text or upload PDF/TXT files and get back natural-sounding audio in WAV or OGG format.

## How It Works

The Python backend exposes a small HTTP API. When a synthesis request comes in, it loads the requested voice model (lazy-loaded and cached in memory), runs Piper, and optionally converts the output to OGG via FFmpeg. A maximum of 2 synthesis requests run concurrently to manage CPU/GPU resources. Completed files are stored server-side with auto-cleanup keeping the last 100 items.

PDF uploads go through a multi-strategy text extractor built on PyMuPDF. It analyzes font sizes and styles to detect headings, lists, code blocks, and table-of-contents sections before handing structured text off to the synthesizer — producing more natural-sounding output than a raw text dump would.

The React frontend manages the full lifecycle: voice and parameter selection (speed, noise), text or file input, submission with cancellation support, and a persistent history of recent syntheses with playback controls, format switching, and one-click re-synthesis.

## Challenges

Raw text extraction from PDFs produced poor TTS output due to images, tables, and index pages. The solution was to use PyMuPDF's font metadata — detecting structural elements by size and style — to filter and reorder content before synthesis.

## Tech Stack

### Backend
- **Python** — using a lightweight HTTP server `rhpy.web` from the project `redhouse-platform` in this portfolio
- **Piper TTS** — text-to-speech engine
- **PyMuPDF** — PDF text extraction and font analysis
- **FFmpeg** — WAV → OGG conversion

### Frontend
- **React + TypeScript** — UI
- **Vite** — build tool
- **Material UI** — component library
