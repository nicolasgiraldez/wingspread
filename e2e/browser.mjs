import { existsSync } from "node:fs";
import { platform } from "node:os";

const CANDIDATES = {
  win32: [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ],
};

/** Ruta de un navegador basado en Chromium: la de E2E_BROWSER o la primera instalada que se encuentre. */
export function findBrowser() {
  const fromEnv = process.env.E2E_BROWSER;
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null;
  return (CANDIDATES[platform()] ?? []).find((path) => existsSync(path)) ?? null;
}

/** La prueba usa el servidor de señalización público de PeerJS: sin internet no puede ejecutarse. */
export async function hasInternet() {
  try {
    const response = await fetch("https://0.peerjs.com/peerjs/id", { signal: AbortSignal.timeout(8000) });
    return response.ok;
  } catch {
    return false;
  }
}
