
import { readdir, stat, mkdir } from "node:fs/promises";
import { join, relative, dirname, extname, basename } from "node:path";
import { spawn } from "bun";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".webm", ".mov", ".avi"]);

async function getDuration(filePath: string): Promise<number> {
  const proc = spawn(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath], {
    stdout: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  return parseFloat(output.trim());
}

async function generateThumbnail(videoPath: string, thumbsDir: string, relativePath: string) {
  const thumbPath = join(thumbsDir, relativePath + ".jpg");
  const thumbDir = dirname(thumbPath);

  try {
    await stat(thumbPath);
    // specific logic: check if newer? for now, skip if exists
    // console.log(`Skipping existing: ${thumbPath}`);
    return;
  } catch (e) {
    // doesn't exist, proceed
  }

  await mkdir(thumbDir, { recursive: true });

  try {
    const duration = await getDuration(videoPath);
    if (isNaN(duration)) {
      console.error(`Could not determine duration for ${videoPath}`);
      return;
    }

    const targetTime = duration / 2;

    const proc = spawn(["ffmpeg", "-ss", targetTime.toString(), "-i", videoPath, "-vframes", "1", "-q:v", "2", thumbPath], {
      stdout: "ignore",
      stderr: "ignore" // set to pipe for debugging
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      console.error(`Failed to generate thumbnail for ${videoPath}`);
    } else {
      console.log(`Generated: ${thumbPath}`);
    }

  } catch (error) {
    console.error(`Error processing ${videoPath}:`, error);
  }
}

async function walk(dir: string, rootDir: string, thumbsDir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      try {
        await walk(fullPath, rootDir, thumbsDir);
      } catch (e) {
        console.error(`Error scanning directory ${fullPath}:`, e);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (VIDEO_EXTENSIONS.has(ext)) {
        await generateThumbnail(fullPath, thumbsDir, relPath);
      }
    }
  }
}

const targetDir = process.argv[2];
if (!targetDir) {
  console.error("Usage: bun run generate_thumbs.ts <directory>");
  process.exit(1);
}

const thumbsDir = join(process.cwd(), "thumbs");

console.log(`Scanning ${targetDir} for videos...`);
console.log(`Saving thumbnails to ${thumbsDir}...`);

try {
  await walk(targetDir, targetDir, thumbsDir);
} catch (e) {
  console.error("Critical error during scan:", e);
}
console.log("Done.");
