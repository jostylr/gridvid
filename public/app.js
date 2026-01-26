
// State
const state = {
    rows: 2,
    cols: 2,
    activeVideo: null,
    config: {
        defaultRows: 2,
        defaultCols: 2,
        defaultMuted: true,
        singleAudio: true
    }
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
        rows: params.has("rows") ? parseInt(params.get("rows"), 10) : null,
        cols: params.has("cols") ? parseInt(params.get("cols"), 10) : null
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
        this.searchTerm = "";
        this.allFiles = []; // Store for filtering
        this.render();

        // Search Cache for backtracking
        this.searchCache = {};
        this.lastCleanSearch = "";
    }

    async loadPath(path) {
        this.currentPath = path;
        this.searchTerm = ""; // Reset search on nav
        this.searchCache = {}; // Reset cache
        this.lastCleanSearch = "";
        this.updateHeader();

        try {
            const res = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
            if (!res.ok) throw new Error("Failed to load");
            this.allFiles = await res.json();
            this.renderFiles();
        } catch (e) {
            console.error(e);
            this.container.querySelector(".file-list").innerHTML = `<div style="padding:20px; color:red">Error loading directory</div>`;
        }
    }

    updateHeader() {
        const header = this.container.querySelector(".path-header");
        header.innerHTML = ""; // Clear

        // 1. Up Button
        if (this.currentPath) {
            const upBtn = createEl("span", "", "⬆️ ");
            upBtn.style.cursor = "pointer";
            upBtn.style.marginRight = "8px";
            upBtn.onclick = (e) => {
                e.stopPropagation();
                this.goUp();
            };
            header.appendChild(upBtn);
        }

        // 2. Path Title
        const title = createEl("span", "", this.currentPath || "/");
        title.style.marginRight = "10px";
        title.style.fontWeight = "bold";
        header.appendChild(title);

        // 3. Search Bar
        const searchContainer = createEl("div", "search-container");
        const input = createEl("input", "search-input");
        input.type = "text";
        input.placeholder = "Search...";
        input.value = this.searchTerm;
        input.oninput = (e) => {
            this.searchTerm = e.target.value.toLowerCase(); // keep lower for consistency, but matching uses normalized
            this.renderFiles();
        };
        // Stop bubbling so typing doesn't trigger other things
        input.onclick = (e) => e.stopPropagation();

        searchContainer.appendChild(input);
        header.appendChild(searchContainer);

        // Pre-load and Normalize Catalog Lazy
        if (!window.fullCatalog && !window.catalogLoading) {
            window.catalogLoading = true;
            fetch("/api/catalog").then(res => res.json()).then(data => {
                const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
                window.fullCatalog = data.map(f => ({
                    ...f,
                    norm: normalize(f.name) + (f.path ? normalize(f.path) : "")
                }));
                window.catalogLoading = false;
            }).catch(e => {
                console.error("Catalog load failed", e);
                window.catalogLoading = false;
            });
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

    renderFiles() {
        const list = this.container.querySelector(".file-list");
        list.innerHTML = "";

        let filesToRender = [];

        // Search Logic
        if (this.searchTerm && this.searchTerm.length >= 3 && window.fullCatalog) {
            const normalize = (str) => str.replace(/[^a-z0-9]/g, "");
            const cleanSearch = normalize(this.searchTerm);

            // Check Cache
            if (this.searchCache[cleanSearch]) {
                filesToRender = this.searchCache[cleanSearch];
            } else {
                // Refine
                let sourceList = window.fullCatalog;

                // If extension of last search, use that result as source
                if (this.lastCleanSearch && cleanSearch.startsWith(this.lastCleanSearch) && this.searchCache[this.lastCleanSearch]) {
                    sourceList = this.searchCache[this.lastCleanSearch];
                }

                filesToRender = sourceList.filter(f => f.norm && f.norm.includes(cleanSearch));

                this.searchCache[cleanSearch] = filesToRender;
            }

            this.lastCleanSearch = cleanSearch;

        } else if (this.searchTerm && this.searchTerm.length < 3) {
            // Show all (wait for 3 chars)
            filesToRender = this.allFiles;
        } else {
            filesToRender = this.allFiles;
        }

        if (filesToRender.length === 0) {
            const msg = (this.searchTerm && this.searchTerm.length >= 3) ? "No matches" : "Empty directory";
            list.innerHTML = `<div style="padding:20px; opacity:0.5">${msg}</div>`;
            return;
        }

        // Limit rendering for performance
        const renderSlice = filesToRender.slice(0, 500);

        renderSlice.forEach(file => {
            const item = createEl("div", "file-item");

            if (file.type === "directory") {
                const icon = createEl("div", "folder-icon", ICONS.folder);
                item.appendChild(icon);
                item.onclick = () => this.loadPath(file.path);
            } else {
                // Video
                const thumbUrl = `/thumbs/${file.path}.jpg`;
                const thumb = createEl("img", "thumbnail");
                thumb.src = thumbUrl;
                thumb.onerror = () => { thumb.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='gray'><rect width='100' height='100'/></svg>"; };
                item.appendChild(thumb);
                item.onclick = () => this.renderPlayer(file.path);
            }

            // Display Name (or Path if search)
            let displayText = file.name.replace(/\.[^/.]+$/, "");

            // If performing a deep search, show context (path)
            if (this.searchTerm && this.searchTerm.length >= 3 && file.path !== file.name) {
                displayText = file.path;
            }

            const name = createEl("div", "file-name", displayText);
            // Add title for hover in case of long paths
            name.title = displayText;
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
        video.muted = state.config.defaultMuted; // Use config
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

// Settings Manager Component
class SettingsManager {
    constructor() {
        this.renderBtn();
        this.renderModal();
    }

    renderBtn() {
        // Create floating settings button
        const btn = createEl("div", "settings-trigger", "⚙️");
        btn.onclick = () => this.openModal();
        document.body.appendChild(btn);
    }

    renderModal() {
        // Modal structure
        this.overlay = createEl("div", "modal-overlay");
        this.overlay.onclick = (e) => {
            if (e.target === this.overlay) this.closeModal();
        };

        const modal = createEl("div", "modal");
        this.overlay.appendChild(modal);

        // Header
        const header = createEl("div", "modal-header");
        header.innerHTML = `<span>Settings</span><span class="close-modal">✖</span>`;
        header.querySelector(".close-modal").onclick = () => this.closeModal();
        modal.appendChild(header);

        // Body
        this.body = createEl("div", "modal-body");
        modal.appendChild(this.body);

        // Footer
        const footer = createEl("div", "modal-footer");
        const saveBtn = createEl("button", "btn btn-primary", "Save");
        saveBtn.onclick = () => this.saveSettings();
        const cancelBtn = createEl("button", "btn btn-secondary", "Cancel");
        cancelBtn.onclick = () => this.closeModal();

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        modal.appendChild(footer);

        document.body.appendChild(this.overlay);
    }

    openModal() {
        // Populate inputs with current state
        this.body.innerHTML = "";

        const cfg = state.config;

        this.addInput("Default Rows", "number", cfg.defaultRows, "defaultRows");
        this.addInput("Default Cols", "number", cfg.defaultCols, "defaultCols");
        this.addToggle("Default Start Muted", cfg.defaultMuted, "defaultMuted");
        this.addToggle("Single Audio Source", cfg.singleAudio, "singleAudio");

        this.overlay.classList.add("active");
    }

    closeModal() {
        this.overlay.classList.remove("active");
    }

    addInput(label, type, value, key) {
        const group = createEl("div", "form-group");
        group.innerHTML = `<label>${label}</label>`;
        const input = createEl("input");
        input.type = type;
        input.value = value;
        input.dataset.key = key;
        group.appendChild(input);
        this.body.appendChild(group);
    }

    addToggle(label, value, key) {
        const row = createEl("div", "toggle-row");
        row.style.margin = "10px 0";
        row.innerHTML = `<label>${label}</label>`;

        const select = createEl("select");
        select.innerHTML = `<option value="true">On</option><option value="false">Off</option>`;
        select.value = value.toString();
        select.dataset.key = key;
        select.dataset.type = "boolean";

        row.appendChild(select);
        this.body.appendChild(row);
    }

    async saveSettings() {
        const newConfig = { ...state.config };

        const inputs = this.body.querySelectorAll("input, select");
        inputs.forEach(input => {
            const key = input.dataset.key;
            let val = input.value;
            if (input.type === "number") val = parseInt(val, 10);
            if (input.dataset.type === "boolean") val = val === "true";

            newConfig[key] = val;
        });

        // Optimistic update
        state.config = newConfig;

        try {
            const res = await fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newConfig)
            });
            if (!res.ok) throw new Error("Failed to save");

            // Reload page to apply grid changes if needed, or just close
            // For simplicity, we just close. Grid requires reload to resize usually, 
            // but we could make it reactive. User requested "Settings button...".
            // Let's notify user "Saved" or just close.
            this.closeModal();
            // Optional: simple alert or toast? 
            // window.location.reload(); // Reloading is safest for grid changes
            if (confirm("Settings saved. Reload to apply grid changes?")) {
                window.location.reload();
            }

        } catch (e) {
            console.error(e);
            alert("Error saving settings");
        }
    }
}

// App Init
async function init() {
    // 1. Fetch Config
    try {
        const res = await fetch("/api/config");
        if (res.ok) state.config = await res.json();
    } catch (e) {
        console.error("Failed to load config, using defaults", e);
    }

    const { rows, cols } = getQueryParams();
    // Prioritize query params -> config -> default fallback (2)
    state.rows = rows || state.config.defaultRows || 2;
    state.cols = cols || state.config.defaultCols || 2;

    const grid = document.getElementById("app-grid");

    // Initialize Settings
    new SettingsManager();

    // Set grid CSS
    grid.style.gridTemplateRows = `repeat(${state.rows}, 1fr)`;
    grid.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;

    // Create cells
    const totalCells = state.rows * state.cols;
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

        if (state.config.singleAudio) {
            // Check if any *other* video is already playing with sound
            const othersWithSound = Array.from(document.querySelectorAll("video")).some(v => v !== current && !v.paused && !v.muted);

            if (othersWithSound) {
                current.muted = true;
            }
        }
    }, true); // Capture phase to catch it early

    document.addEventListener("volumechange", (e) => {
        if (e.target.tagName !== "VIDEO") return;
        const current = e.target;

        if (!current.muted && state.config.singleAudio) {
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
