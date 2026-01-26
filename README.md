# vidserver

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

VidServer Walkthrough
I have created the VidServer application. It consists of a Bun-based HTTP server and a thumbnail generation script.

functionality
Grid Layout: Videos are displayed in a customizable grid (default 2x2).
Independent Browsing: Each grid cell is an independent file browser.
Video Playback: Clicking a video thumbnail plays it in a modal overlay.
Thumbnail Generation: A script generates thumbnails for video files using ffmpeg.
Prerequisites
Bun: Javascript runtime.
ffmpeg: Required for thumbnail generation (must be in system PATH).
Usage
1. Generate Thumbnails
Run the generator script on your video directory.

bun run generate_thumbs.ts /path/to/videos
This will create a thumbs directory in the project root, mirroring the structure of your video directory.

2. Start the Server
Start the server, pointing it to your video directory.

bun run index.ts /path/to/videos
The server will start on port 8080.

3. Open in Browser
Visit http://localhost:8080.

Customizing Grid: Append parameters to the URL:

http://localhost:8080/?rows=1&cols=3
http://localhost:8080/?rows=3&cols=3
Implementation Details
Server (
index.ts
): Handles static files, /api/list for directory listings, and streams videos/thumbnails.
Frontend (public/): Vanilla JS/CSS. Uses CSS Grid for layout and Fetch API for navigation.
Thumbnails: Stored locally in thumbs/ to avoid real-time generation cost.
NOTE

The server listens on port 8080 by default. If 8080 is in use, it will automatically try port 8081.