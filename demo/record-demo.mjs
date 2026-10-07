import { chromium } from "playwright";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDirectory = path.join(root, "demo", "recordings");
const outputVideo = path.join(outputDirectory, "video-assistant-demo.webm");
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;
const pause = (milliseconds) => page.waitForTimeout(milliseconds);

if (!email || !password) {
    throw new Error("Set DEMO_EMAIL and DEMO_PASSWORD before recording.");
}

await mkdir(outputDirectory, { recursive: true });
const log = (message) => console.log(`[demo] ${message}`);

const browser = await chromium.launch({ headless: true });
const setupContext = await browser.newContext();
const setupPage = await setupContext.newPage();

log("Authenticating demo account in an unrecorded setup session");
await setupPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
await setupPage.waitForTimeout(1200);
if (await setupPage.getByRole("button", { name: /Sign in/ }).count()) {
    await setupPage.getByLabel("Email").fill(email);
    await setupPage.getByLabel("Password").fill(password);
    await setupPage.getByRole("button", { name: /Sign in/ }).click();
}
await setupPage.locator(".library-item").first().waitFor({ timeout: 30000 });
const storageState = await setupContext.storageState();
await setupContext.close();

const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState,
    recordVideo: { dir: outputDirectory, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

log("Opening authenticated application for recording");

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const libraryVideos = page.locator(".library-item");
await libraryVideos.first().waitFor({ timeout: 30000 });
const videoCount = await libraryVideos.count();
log(`Loaded ${videoCount} saved videos`);

if (videoCount === 0) {
    throw new Error("The demo account has no saved videos.");
}

await libraryVideos.first().click();
log("Opened the first saved video");
await page.getByText("ready", { exact: true }).first().waitFor({ timeout: 30000 });
await pause(3500);

log("Creating a fresh conversation");
await pause(1800);
await page.getByRole("button", { name: /Create new conversation/ }).click();
await pause(2500);

log("Typing the question");
const question = page.getByPlaceholder("Ask about this video...");
await question.pressSequentially("Give me three concise points this video teaches.", { delay: 55 });
await pause(1800);
log("Sending the question");
await page.getByRole("button", { name: /Send/ }).click();
await pause(15000);
log("Chat response rendered");

await pause(2500);
log("Switching back to the video library");
await page.getByRole("button", { name: /Change video/ }).click();
await pause(2500);
log("Opening the second saved video");
await libraryVideos.nth(Math.min(1, videoCount - 1)).click();
await page.getByText("ready", { exact: true }).first().waitFor();
await pause(4500);
log("Reopened another saved video and restored its history");

const videoRecording = page.video();
await context.close();
const recordedVideo = await videoRecording.path();
await copyFile(recordedVideo, outputVideo);
await browser.close();

log(`Saved recording to ${outputVideo}`);
