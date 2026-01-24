# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

```bash
bun start           # Run in development mode (compiles SASS + runs with ELECTRON_DISABLE_SANDBOX=1)
bun run sass        # Compile SASS to CSS (one-time)
bun run sass:watch  # Watch and auto-compile SASS changes
bun run dist        # Build for current platform
bun run dist:win    # Build Windows installer (NSIS)
bun run dist:linux  # Build Linux packages (deb + AppImage)
bun run dist:mac    # Build macOS (dmg)
```

## External Requirements

- Bun (https://bun.sh)
- FFmpeg (required for RTSP transcoding, not included in dependencies)

## Architecture

Vigilante is an Electron desktop app that displays RTSP camera streams in a dynamic grid using JSMpeg.

### Process Flow

1. **Main process** (`src/main/index.js`) creates the Electron window, sets up IPC handlers, and initializes the stream service
2. **Stream service** (`src/main/StreamService.js`) orchestrates configuration and relay server operations
3. **Preload** (`src/preload/preload.cjs`) exposes IPC APIs to the renderer via contextBridge
4. **Renderer** (`src/renderer/renderer.js`) displays streams in a dynamic grid and provides settings UI

### Domain/Infrastructure Separation

The main process follows a layered architecture:

- **Domain** (`src/main/domain/`): Business logic and value objects
  - `StreamConfiguration.js` - Immutable value object for stream config (name, url)

- **Infrastructure** (`src/main/infrastructure/`): External concerns
  - `ConfigurationRepository.js` - Persists stream configs to `streams.json` in user data directory
  - `StreamRelayServer.js` - Express/WebSocket server that proxies RTSP streams via `rtsp-relay`

- **Application** (`src/main/StreamService.js`): Coordinates domain and infrastructure

### IPC API

The preload script exposes these APIs to the renderer:
- `getConfiguration()` - Get all stream configurations
- `getServerPort()` - Get the relay server port (dynamically assigned)
- `addStream(name, url)` - Add a new stream
- `removeStream(index)` - Remove a stream by index
- `saveAllStreams(streams)` - Bulk save all streams
- `exportConfiguration()` - Export current configuration to a file
- `importConfiguration()` - Import configuration from a file
- `onOpenSettings(callback)` - Listen for settings dialog open events
- `onExportConfiguration(callback)` - Listen for export configuration events
- `onImportConfiguration(callback)` - Listen for import configuration events
- `getPlatform()` - Get the current platform identifier

### Configuration

- Stream configuration is stored in `streams.json` in the user's data directory (`app.getPath('userData')`)
- Users configure streams through the UI (gear icon or menu: Cmd/Ctrl+,)
- Configurations can be imported/exported through the UI for backup or sharing
- No config files needed at project root - everything is managed through the UI

### Dynamic Grid

- Grid automatically adjusts based on stream count (1x1, 2x1, 2x2, 3x2, 3x3, etc.)
- Each stream connects via WebSocket to `/api/stream/:index` on the relay server
- Server port is dynamically assigned (port 0) and communicated to renderer via IPC

### Styling

- Uses SASS for styles (`src/renderer/styles/main.sass`)
- SASS is compiled to CSS before running or building the app
- Use `bun run sass:watch` during development to auto-compile on changes
