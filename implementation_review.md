# VidServer Enhancements Review

## Implemented Features

### 1. Search Functionality
- **UI**: Added a search bar in the header of each grid cell.
- **Logic**: Implemented a robust client-side search with:
    - Normalization (ignores case/symbols)
    - 3-character threshold for performance
    - Recursive search through the full catalog
    - Result caching for speed
    - Multi-term AND logic (e.g., "video 2024" matches "My Video 2024.mp4")

### 2. Configuration & Settings
- **Server**: Added `config.json` support and `/api/config` endpoints to read/write settings.
- **Client**: 
    - **Settings Modal**: Accessible via a floating gear icon. Allows changing defaults.
    - **Persistence**: Settings are saved to `config.json` (server-side default) but user overrides are stored in Cookies.
    - **Query Parameters**: Overrides available via URL (e.g., `?muted=false&singleAudio=false`).

### 3. Responsive Grid Defaults
- The app now automatically selects grid size based on screen width:
    - Phone (<600px): Small (1x1)
    - Tablet (<1200px): Medium (2x2)
    - Desktop: Large (3x3)
- These sizes can be configured in `config.json`.

### 4. Audio Management
- **Defaults**: Videos start muted by default (configurable).
- **Exclusivity**: added `singleAudio` mode (default on) which ensures only one video plays with sound at a time.
    - Starting a new video mutes others.
    - Unmuting a video mutes others.

### 5. File Support
- **.m4v**: Added `.m4v` to the list of recognized video extensions in both the server (`index.ts`) and thumbnail generator.

## Usage
- Open the settings gear to change defaults.
- Use the search bar to find videos deep in subfolders.
- Responsive grid should work automatically on resize (reload may be required for grid size to change if sticking to state).

## Verification
- Code has been updated in `index.ts`, `public/app.js`, `public/style.css`, and `config.json`.
- `generate_thumbs.ts` was verified to support `.m4v`.
