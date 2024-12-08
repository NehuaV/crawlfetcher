import { stat, mkdir } from "fs/promises";
import { Worker } from "worker_threads";
import path from "path";
import type { ChapterImage } from "./lib/types";
import { PlaywrightBlocker } from "@cliqz/adblocker-playwright";
import { firefox } from "playwright";
import type { Environment, Integration } from "./integrations";

export async function upsertDir(dir: string) {
  try {
    await stat(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

function createImageDownloadWorker(
  chapter: ChapterImage,
  chapterDir: string,
  environment: Environment
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "worker.ts"));

    worker.on("message", (message) => {
      if (message.success) {
        resolve(message.filename);
      } else {
        reject(new Error(message.error));
      }
    });

    worker.on("error", reject);
    worker.postMessage({
      chapter,
      chapterDir,
      environment,
    });
  });
}

export async function createBrowser() {
  const browser = await firefox.launch({
    headless: true,
  });
  const context = await browser.newContext();

  // Setup the ad blocker
  const blocker = await PlaywrightBlocker.fromLists(fetch, [
    "https://easylist.to/easylist/easylist.txt",
    // more filter lists
    // 'https://easylist-downloads.adblockplus.org/uce.txt',
  ]);

  const page = await context.newPage();
  await blocker.enableBlockingInPage(page);

  return { browser, context, page };
}
