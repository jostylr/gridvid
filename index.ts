
import { serve, file } from "bun";
import { join, isAbsolute, normalize, relative, extname } from "node:path";
import { readdir, stat } from "node:fs/promises";

// Configuration

const ROOT_DIR = resolvePath(process.argv[2] || ".");
const THUMBS_DIR = join(process.cwd(), "thumbs");
const PUBLIC_DIR = join(process.cwd(), "public");

function resolvePath(p: string) {
    return isAbsolute(p) ? p : join(process.cwd(), p);
}

// Security check to ensure we don't serve files outside logic
function isSafePath(target: string, root: string) {
    const rel = relative(root, target);
    return !rel.startsWith("..") && !isAbsolute(rel);
}

const tryPorts = [8080, 8081];

for (const port of tryPorts) {
    try {
        const server = serve({
            port: port,
            async fetch(req) {
                const url = new URL(req.url);
                const pathname = url.pathname;

                // API: List files
                if (pathname === "/api/list") {
                    const queryPath = url.searchParams.get("path") || "";
                    // Prevent traversing up from root
                    const targetPath = join(ROOT_DIR, queryPath);

                    if (!isSafePath(targetPath, ROOT_DIR)) {
                        return new Response("Forbidden", { status: 403 });
                    }

                    try {
                        const entries = await readdir(targetPath, { withFileTypes: true });
                        const result = [];

                        for (const entry of entries) {
                            // simple filter, adjust as needed
                            if (entry.name.startsWith(".")) continue;

                            if (entry.isDirectory()) {
                                result.push({
                                    name: entry.name,
                                    type: "directory",
                                    path: join(queryPath, entry.name)
                                });
                            } else {
                                const ext = extname(entry.name).toLowerCase();
                                // Assuming similar extensions as generator
                                if ([".mp4", ".mkv", ".webm", ".mov", ".avi"].includes(ext)) {
                                    result.push({
                                        name: entry.name,
                                        type: "file",
                                        path: join(queryPath, entry.name)
                                    });
                                }
                            }
                        }

                        // Sort: Directories first, then files
                        result.sort((a, b) => {
                            if (a.type === b.type) return a.name.localeCompare(b.name);
                            return a.type === "directory" ? -1 : 1;
                        });

                        return Response.json(result);
                    } catch (e) {
                        return new Response("Not Found", { status: 404 });
                    }
                }

                // Serve Thumbnails
                if (pathname.startsWith("/thumbs/")) {
                    const filePath = pathname.replace("/thumbs/", "");
                    const targetThumb = join(THUMBS_DIR, filePath);
                    if (!isSafePath(targetThumb, THUMBS_DIR)) {
                        return new Response("Forbidden", { status: 403 });
                    }

                    return new Response(file(targetThumb));
                }

                // Serve Videos
                if (pathname.startsWith("/videos/")) {
                    const relPath = decodeURIComponent(pathname.replace("/videos/", ""));
                    const targetVideo = join(ROOT_DIR, relPath);

                    if (!isSafePath(targetVideo, ROOT_DIR)) {
                        return new Response("Forbidden", { status: 403 });
                    }

                    return new Response(file(targetVideo));
                }

                // Serve Static Files (Frontend)
                let staticPath = pathname === "/" ? "/index.html" : pathname;
                const targetStatic = join(PUBLIC_DIR, staticPath);

                const f = file(targetStatic);
                if (await f.exists()) {
                    return new Response(f);
                }

                return new Response("Not Found", { status: 404 });
            },
        });

        console.log(`Server started on http://localhost:${server.port}`);
        console.log(`Available addresses:`);
        for (const ip of getLocalIps()) {
            console.log(`  ${ip}:${server.port}`);
        }
        break; // Success
    } catch (e: any) {
        if (e.code === "EADDRINUSE") {
            console.log(`Port ${port} is in use, trying next...`);
            if (port === tryPorts[tryPorts.length - 1]) {
                console.error("Could not find a free port.");
                process.exit(1);
            }
        } else {
            throw e;
        }
    }
}

function getLocalIps() {
    const { networkInterfaces } = require("os");
    const nets = networkInterfaces();
    const results = [];

    // Always add localhost
    results.push("http://localhost");  // or 127.0.0.1
    // Add explicitly if desired, but localhost is enough cover for 127.0.0.1 typically. 
    // User asked for reproduction of list including 127.0.0.1, so let's add it.
    results.push("http://127.0.0.1");

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4
            if (net.family === 'IPv4' && !net.internal) {
                results.push(`http://${net.address}`);
            }
        }
    }
    return results;
}

const localIps = getLocalIps();