# Redhouse Platform

A shared platform monorepo providing reusable libraries and tooling for my custom "Redhouse" microservice ecosystem. Rather than duplicating boilerplate across services, each project pulls in what it needs from here.

## What's Inside

### Python — `rhpy`

A lightweight async microservice framework built on Starlette and heavily utilizing Pydantic models for validation. Notable features:

- **Config system** — parse JSON config files with automatic camelCase to snake_case conversion and validated by Pydantic
- **Settings saving** — auto-load, and save changes to `Settings` instances to disk, with a debounce to prevent rapid i/o
- **HTTP router** — define routes with simple decorators (`@get`, `@post`, etc.) and optional Pydantic models for body/query validation
- **Redis client** — connection caching and sharing, with pub/sub convenience methods, key prefixing, local socket inference from IP, and last-value history
- **Threads manager** — registry of threads with graceful shutdown support
- **Repeat timers** — registry of timers with auto-rescheduling until canceled
- **Structured logging** — logfmt format and duplication-flood protection
- **Lifecycle hooks** — startup and teardown hooks
- **Prometheus metrics** — automatic prometheus metrics at `/metrics` endpoint

### Node.js — shared packages

A set of npm packages consumed by frontend services:

- **@rh/react** — react component library on top of Material UI
- **@rh/tsconfig** — shared TypeScript config (ES2022, strict, bundler resolution)
- **@rh/vite** — shared Vite config factory (React plugin, deduplication, public output)
- **@rh/eslint-config** — shared ESLint 10 config enforcing direct MUI imports, import sorting, and TypeScript rules
