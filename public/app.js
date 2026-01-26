
// State
const state = {
    rows: 2,
    cols: 2,
    activeVideo: null
};

// Icons (Simple generic SVG placeholders or emojis)
const ICONS = {
    folder: "📁",
    video: "🎬",
    unknown: "📄"
};

// Utils
function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        rows: parseInt(params.get("rows") || "2", 10),
        cols: parseInt(params.get("cols") || "2", 10)
    };
}

function createEl(tag, className, text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
}

// Component: File Browser Cell
class FileBrowser {
    constructor(containerId) {
        this.currentPath = "";
        this.container = document.getElementById(containerId);
        this.render();
    }

    async loadPath(path) {
        this.currentPath = path;
        this.updateHeader();

        try {
            const res = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
            if (!res.ok) throw new Error("Failed to load");
            const files = await res.json();
            this.renderFiles(files);
        } catch (e) {
            console.error(e);
            this.container.querySelector(".file-list").innerHTML = `<div style="padding:20px; color:red">Error loading directory</div>`;
        }
    }

    updateHeader() {
        const header = this.container.querySelector(".path-header");
        // Show "Root" if empty, otherwise path
        header.textContent = this.currentPath || "/";

        // Add "Up" button if not root
        if (this.currentPath) {
            const upBtn = createEl("span", "", " ⬆️");
            upBtn.style.cursor = "pointer";
            upBtn.style.marginLeft = "10px";
            upBtn.onclick = (e) => {
                e.stopPropagation();
                this.goUp();
            };
            header.appendChild(upBtn);
        }
    }

    goUp() {
        // Simple string manipulation for path
        const parts = this.currentPath.split("/");
        parts.pop();
        this.loadPath(parts.join("/"));
    }

    render() {
        this.container.innerHTML = "";

        const header = createEl("div", "path-header");
        this.container.appendChild(header);

        const list = createEl("div", "file-list");
        this.container.appendChild(list);

        // Initial load
        this.loadPath("");
    }

    renderFiles(files) {
        const list = this.container.querySelector(".file-list");
        list.innerHTML = "";

        if (files.length === 0) {
            list.innerHTML = `<div style="padding:20px; opacity:0.5">Empty directory</div>`;
            return;
        }

        files.forEach(file => {
            const item = createEl("div", "file-item");

            if (file.type === "directory") {
                const icon = createEl("div", "folder-icon", ICONS.folder);
                item.appendChild(icon);

                item.onclick = () => this.loadPath(file.path);
            } else {
                // Video file
                // Try to find thumbnail
                // Thumb path logic: /thumbs/path/to/video.mp4.jpg
                const thumbUrl = `/thumbs/${file.path}.jpg`;

                const thumb = createEl("img", "thumbnail");
                thumb.src = thumbUrl;
                thumb.onerror = () => { thumb.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='gray'><rect width='100' height='100'/></svg>"; }; // Fallback

                item.appendChild(thumb);

                item.onclick = () => this.renderPlayer(file.path);
            }

            // Strip extension for display
            const displayName = file.name.replace(/\.[^/.]+$/, "");
            const name = createEl("div", "file-name", displayName);
            item.appendChild(name);

            list.appendChild(item);
        });
    }

    renderPlayer(path) {
        this.container.innerHTML = "";

        const playerContainer = createEl("div", "inline-player-container");

        const backBtn = createEl("button", "back-btn", "⬅ Back");
        backBtn.onclick = () => {
            // Explicitly clean up video to prevent memory/decoder leaks
            const video = playerContainer.querySelector("video");
            if (video) {
                video.pause();
                video.removeAttribute("src"); // Remove src attribute
                video.load(); // Force release of media resources
            }

            this.container.innerHTML = "";
            const header = createEl("div", "path-header");
            this.container.appendChild(header);
            const list = createEl("div", "file-list");
            this.container.appendChild(list);
            this.loadPath(this.currentPath);
        };
        playerContainer.appendChild(backBtn);

        const fsBtn = createEl("button", "fullscreen-btn", "⤢ Full Screen");
        fsBtn.onclick = () => {
            const video = playerContainer.querySelector("video");
            if (video) {
                if (video.requestFullscreen) video.requestFullscreen();
                else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
            }
        };
        playerContainer.appendChild(fsBtn);

        const video = createEl("video", "");
        video.controls = true;
        video.autoplay = true;
        video.muted = true; // Default to muted
        video.playsInline = true; // Better mobile/safari support
        video.src = `/videos/${encodeURIComponent(path)}`;

        const muteBtn = createEl("button", "mute-btn", "🔊 Unmute");
        muteBtn.onclick = () => {
            video.muted = !video.muted;
            muteBtn.textContent = video.muted ? "🔊 Unmute" : "🔇 Mute";
        };
        playerContainer.appendChild(muteBtn);

        // Sync button if user uses native controls
        video.onvolumechange = () => {
            muteBtn.textContent = video.muted ? "🔊 Unmute" : "🔇 Mute";
        };

        playerContainer.appendChild(video);
        this.container.appendChild(playerContainer);
    }

    playVideo(path) {
        // Hide file list, show video player
        this.container.querySelector(".file-list").style.display = "none";
        const videoContainer = this.container.querySelector(".in-place-video-container");
        videoContainer.classList.add("active");

        this.videoPlayer.src = `/videos/${encodeURIComponent(path)}`;
        this.videoPlayer.play().catch(e => console.log("Auto-play prevented", e));
    }

    closeVideo() {
        // Hide video player, show file list
        const videoContainer = this.container.querySelector(".in-place-video-container");
        videoContainer.classList.remove("active");
        this.container.querySelector(".file-list").style.display = ""; // Reset to default display

        this.videoPlayer.pause();
        this.videoPlayer.src = ""; // Clear source
    }
}

// Video Player Logic moved inside FileBrowser class

// App Init
function init() {
    const { rows, cols } = getQueryParams();
    state.rows = rows;
    state.cols = cols;

    const grid = document.getElementById("app-grid");

    // Set grid CSS
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    // Create cells
    const totalCells = rows * cols;
    for (let i = 0; i < totalCells; i++) {
        const cellId = `cell-${i}`;
        const cell = createEl("div", "browser-cell");
        cell.id = cellId;
        grid.appendChild(cell);

        // Initialize browser in this cell
        new FileBrowser(cellId);
    }

    // Close modal on click outside (legacy cleanup, but good to keep if valid)
    const overlay = document.getElementById("video-overlay");
    if (overlay) {
        overlay.onclick = (e) => {
            if (e.target.id === "video-overlay") closeVideo();
        };
    }

    // Audio Manager: Exclusive sound
    // 1. When a video Plays:
    //    - If another video is already playing with sound, MUTE the new one.
    //    - If no other video is playing with sound, allow new one to have sound.
    // 2. When a video Unmutes (volumechange):
    //    - MUTE all other videos.

    document.addEventListener("play", (e) => {
        if (e.target.tagName !== "VIDEO") return;
        const current = e.target;

        // Check if any *other* video is playing with sound
        const othersWithSound = Array.from(document.querySelectorAll("video")).some(v => v !== current && !v.paused && !v.muted);

        if (othersWithSound) {
            current.muted = true;
        }
    }, true); // Capture phase to catch it early

    document.addEventListener("volumechange", (e) => {
        if (e.target.tagName !== "VIDEO") return;
        const current = e.target;

        if (!current.muted) {
            // This video just unmuted (or volume increased), mute everyone else
            document.querySelectorAll("video").forEach(v => {
                if (v !== current) {
                    v.muted = true;
                }
            });
        }
    }, true);

    // Auto-pause others on fullscreen
    document.addEventListener("fullscreenchange", () => {
        if (document.fullscreenElement && document.fullscreenElement.tagName === "VIDEO") {
            const activeVideo = document.fullscreenElement;
            document.querySelectorAll("video").forEach(v => {
                if (v !== activeVideo && !v.paused) {
                    v.pause();
                }
            });
        }
    });
}

window.addEventListener("DOMContentLoaded", init);
