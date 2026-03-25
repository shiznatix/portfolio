# Home Bin

An organized, alias-driven CLI of (mostly) bash scripts, with tab-completion support for common development, system, and network tasks.

## Command Groups

- `crypt` — GPG encryption/decryption for files and directories
- `dev` — Development shortcuts (gitignore generation, VS Code setup)
- `fs` — Filesystem utilities (disk info, large file detection)
- `git` — Git automation (commit+push, status)
- `gpu` — NVIDIA GPU monitoring (utilization, temperature, power)
- `js` — JavaScript/NodeJS tools (npm build watching with notifications)
- `meta` — File metadata operations (strip EXIF, reset timestamps via exiftool/setfattr)
- `net` — Network utilities (device scanning, SSH config, static IP, MAC vendor lookup)
- `pi` — Raspberry Pi scripts (throttle detection, CPU/memory watching)
- `py` — Python project automation (venv creation, dependency management via uv)
- `sys` — System maintenance (apt/snap upgrades)
- `vid` — Video operations (editing, downloading)
- `zip` — Archive utilities (7z chunking, combining, extraction)

## Packages

- `monnom` — A colorful terminal dashboard for real-time system monitoring (CPU, memory, GPU, temperature). I made it to help debug when and why my CPU would throttle, GPU would be maxed out, and dev environment would lag.

## How It Works

The main `homebin` script acts as a router, delegating the args to the corresponding commands. Each script implements the argv flag `--completion` which is used by `homebin` for tab-completion. The project `manage-machines` (separate project in this portfolio) is used to install the selected scripts, and create aliases in the user's $PATH. The `homebin` script is context aware of the various aliases, and is able to provide auto-completion for aliases as well.

## Challenges

Auto-completion was the hardest part. I wanted to have only 1 place to manage auto-completions for all of the scripts, while also supporting each possible alias level. The result is in the `.completion.sh` file.

I had a hard time abandoning any feature that I started implementing. Naturally, the scope expanded beyond the original needs, but the result is a well-tested, extensible toolset I use daily.

## Tech Stack

- **Bash** — core scripting, with ANSI color output, signal trapping, and dynamic shell completion (bash/zsh)
- **Python** — `monnom` monitoring dashboard using the Rich library
- **External tools** — `git`, `gpg`, `7z`, `ffmpeg`, `exiftool`, `nvidia-smi`, `vcgencmd`
