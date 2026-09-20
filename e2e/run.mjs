/**
 * Prueba de extremo a extremo del multijugador con DOS navegadores reales.
 *
 * Levanta la build de producción (`npm run build` antes), abre un anfitrión y un invitado que se
 * conectan por WebRTC a través del servidor de señalización de PeerJS, y juega una partida
 * completa comprobando que ambos ven siempre el mismo estado, mientras provoca los problemas
 * típicos: recargas, cortes de conexión e intrusos.
 *
 *   npm run e2e
 *
 * Variables de entorno:
 *   E2E_BROWSER  ruta de un Chrome/Edge/Chromium (por defecto se busca uno instalado)
 *   E2E_URL      probar una versión ya desplegada en vez de levantar la build local
 *   E2E_BAIL=1   parar en el primer fallo
 *   E2E_HEADED=1 mostrar los navegadores
 *
 * Códigos de salida: 0 todo bien, 1 algún escenario falló, 2 faltan requisitos (navegador/internet).
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { preview } from "vite";
import { findBrowser, hasInternet } from "./browser.mjs";

const OUT = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const executablePath = findBrowser();
if (!executablePath) {
  console.error("No se encontró Chrome/Edge/Chromium. Indica uno con E2E_BROWSER=<ruta>.");
  process.exit(2);
}
if (!(await hasInternet())) {
  console.error("Sin conexión al servidor de señalización de PeerJS (0.peerjs.com): no se puede probar la red.");
  process.exit(2);
}

// ── Servidor y navegador ─────────────────────────────────────────────────────

let server = null;
let BASE = process.env.E2E_URL;
if (!BASE) {
  server = await preview({ logLevel: "error", preview: { host: "127.0.0.1", port: 0 } });
  BASE = `http://127.0.0.1:${server.httpServer.address().port}/`;
}

const browser = await chromium.launch({
  executablePath,
  headless: !process.env.E2E_HEADED,
  // Sin esto Chrome oculta las IP locales tras mDNS y dos navegadores en la misma máquina no se ven.
  args: ["--disable-features=WebRtcHideLocalIpsWithMdns", "--no-sandbox"],
});

const t0 = Date.now();
const log = (message) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s ${message}`);
const pageErrors = [];
const players = [];

async function newPlayer(name) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  // Guarda las RTCPeerConnection de la página para poder cortarlas a mano (simula una caída real).
  await context.addInitScript(() => {
    const Original = window.RTCPeerConnection;
    window.__pcs = [];
    window.RTCPeerConnection = function (...args) {
      const pc = new Original(...args);
      window.__pcs.push(pc);
      return pc;
    };
    window.RTCPeerConnection.prototype = Original.prototype;
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(`[${name}] ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(`[${name}] console.error: ${message.text().slice(0, 200)}`);
  });
  const player = { name, context, page };
  players.push(player);
  return player;
}

const host = await newPlayer("host");
const guest = await newPlayer("guest");

// ── Escenarios ───────────────────────────────────────────────────────────────

const results = [];

async function step(title, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ title, ok: true });
    log(`✅ ${title} (${Date.now() - started} ms)${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push({ title, ok: false });
    log(`❌ ${title}: ${String(error.message ?? error).slice(0, 900)}`);
    for (const player of players) {
      await player.page.screenshot({ path: `${OUT}fallo-${results.length}-${player.name}.png` }).catch(() => {});
    }
    if (process.env.E2E_BAIL) await finish(1);
  }
}

const waitStatus = (player, text, timeout = 30_000) =>
  player.page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });

/** Lo que ven los dos por igual: ronda, dados, turno, puntuación y registro (sin las vistas personales). */
const fingerprint = (player) =>
  player.page.evaluate(() => {
    const dice = [...document.querySelectorAll(".die-token")].map((button) => button.title).join("|");
    const round = document.body.innerText.match(/Ronda\s*(\d)\s*de 4/)?.[1] ?? "?";
    const shared = /^(TURNO ACTUAL|PUNTUACIÓN EN VIVO|REGISTRO DE ACCIONES)/i;
    const cards = [...document.querySelectorAll(".status-card")]
      .map((card) => card.innerText.replace(/\s+/g, " ").trim())
      .filter((text) => shared.test(text))
      .map((text) => text.replace(/\s*\((Tú|Vos)\)/g, "").replace(/\s*\(Invitado\)/g, ""));
    return `R${round} dice[${dice}] ${cards.join(" || ")}`;
  });

async function sameState(label, timeout = 15_000) {
  const until = Date.now() + timeout;
  let a = "";
  let b = "";
  while (Date.now() < until) {
    a = await fingerprint(host);
    b = await fingerprint(guest);
    if (a === b && a.startsWith("R")) return a.slice(0, 60);
    await host.page.waitForTimeout(250);
  }
  throw new Error(`${label}: los estados no coinciden\n host : ${a}\n guest: ${b}`);
}

async function takeADie(player) {
  const normal = player.page.locator(".die-token:not(.die-wild)");
  if ((await normal.count()) > 0) {
    await normal.first().click();
  } else {
    await player.page.locator(".die-token").first().click();
    await player.page.getByTitle("Tomar 1 insecto/gusano").click();
  }
}

async function canMove(player) {
  const die = player.page.locator(".die-token").first();
  return (await die.count()) > 0 && (await die.isEnabled());
}

/** Juega `count` jugadas (solo tomar dados), cada una con quien tenga el turno. */
async function playMoves(count) {
  for (let i = 0; i < count; i += 1) {
    const until = Date.now() + 25_000;
    let mover = null;
    while (!mover && Date.now() < until) {
      if (await host.page.getByText("(Terminada)").count()) return;
      if (await canMove(host)) mover = host;
      else if (await canMove(guest)) mover = guest;
      else await host.page.waitForTimeout(100);
    }
    if (!mover) throw new Error("nadie pudo mover en 25 s");
    await takeADie(mover);
    await host.page.waitForTimeout(150);
  }
}

async function playAndCompare(count) {
  for (let i = 1; i <= count; i += 1) {
    await playMoves(1);
    await sameState(`tras la jugada ${i}`);
  }
}

async function joinAsGuest(player, code, name) {
  await player.page.goto(`${BASE}?room=${code}`);
  await player.page.getByPlaceholder("Tu nombre...").fill(name);
  await player.page.getByRole("button", { name: /Unirse/ }).click();
}

const cutConnections = (player) => player.page.evaluate(() => window.__pcs.forEach((pc) => pc.close()));
const seconds = (since) => `${((Date.now() - since) / 1000).toFixed(1)} s`;

let roomCode = "";

await step("El anfitrión crea una sala", async () => {
  await host.page.goto(BASE);
  await host.page.getByPlaceholder("Escribí tu nombre...").fill("Lucía");
  await host.page.getByRole("button", { name: /Multijugador Online/ }).click();
  await host.page.getByRole("button", { name: /Crear Sala/ }).click();
  const code = host.page.locator("strong").filter({ hasText: /^[a-z]+-\d{3}$/ });
  await code.waitFor({ timeout: 20_000 });
  roomCode = (await code.first().innerText()).trim();
  await waitStatus(host, "Esperando Oponente");
  return `sala ${roomCode}`;
});

await step("El invitado se une con el enlace y ambos quedan conectados", async () => {
  const started = Date.now();
  await joinAsGuest(guest, roomCode, "Mateo");
  await waitStatus(host, "Conectado en Vivo");
  await waitStatus(guest, "Conectado en Vivo");
  return `conectados en ${seconds(started)}`;
});

await step("Ambos preparan su mano inicial (bonificación y confirmar) y arranca la ronda 1", async () => {
  // Sin conservar aves no hay que descartar comida: basta elegir la bonificación y confirmar.
  for (const player of [host, guest]) {
    await player.page.getByRole("button", { name: "Elegir esta" }).first().click({ timeout: 15_000 });
    await player.page.getByRole("button", { name: "Confirmar mano inicial" }).click();
  }
  await host.page.getByText(/Ronda\s*1\s*de 4/).first().waitFor({ timeout: 15_000 });
  await guest.page.getByText(/Ronda\s*1\s*de 4/).first().waitFor({ timeout: 15_000 });
  await sameState("tras el setup");
});

await step("Jugadas alternadas: el estado coincide en ambos tras cada una (6 jugadas)", () => playAndCompare(6));

await step("El invitado recarga la página y vuelve a su partida", async () => {
  await guest.page.reload();
  const started = Date.now();
  await guest.page.getByPlaceholder("Tu nombre...").fill("Mateo");
  await guest.page.getByRole("button", { name: /Unirse/ }).click();
  await waitStatus(guest, "Conectado en Vivo");
  await sameState("tras la recarga del invitado");
  return `de vuelta en ${seconds(started)}`;
});

await step("Tras la recarga se puede seguir jugando (4 jugadas)", () => playAndCompare(4));

await step("Un intruso no puede quitarle el asiento al invitado y ve un aviso", async () => {
  const intruder = await newPlayer("intruso");
  await joinAsGuest(intruder, roomCode, "Intruso");
  await intruder.page.getByText(/La sala ya tiene otro invitado/).waitFor({ timeout: 20_000 });
  await sameState("con el intruso intentando entrar");
  await playMoves(1);
  await sameState("jugando con el intruso fuera");
  await intruder.context.close();
  players.pop();
});

await step("El anfitrión recarga y reanuda la sala guardada; el invitado se reconecta solo", async () => {
  await host.page.reload();
  await host.page.getByText("Partida en curso").waitFor({ timeout: 10_000 });
  const started = Date.now();
  await host.page.getByRole("button", { name: "Continuar" }).click();
  await waitStatus(host, "Conectado en Vivo", 90_000);
  await waitStatus(guest, "Conectado en Vivo", 90_000);
  await sameState("tras reanudar la sala");
  return `reconectado en ${seconds(started)}`;
});

await step("Tras reanudar se puede seguir jugando (4 jugadas)", () => playAndCompare(4));

await step("Se cae el canal del invitado (sin recargar): se reconecta solo y sigue jugando", async () => {
  await cutConnections(guest);
  const started = Date.now();
  await waitStatus(host, "Esperando Oponente", 15_000);
  await waitStatus(guest, "Conectado en Vivo", 90_000);
  await waitStatus(host, "Conectado en Vivo", 30_000);
  await sameState("tras reconectar", 30_000);
  await playAndCompare(2);
  return `recuperado en ${seconds(started)}`;
});

await step("Se cae el canal desde el lado del anfitrión: el invitado insiste y se recupera", async () => {
  await cutConnections(host);
  const started = Date.now();
  await waitStatus(guest, "Conectado en Vivo", 90_000);
  await waitStatus(host, "Conectado en Vivo", 30_000);
  await sameState("tras reconectar", 30_000);
  await playAndCompare(2);
  return `recuperado en ${seconds(started)}`;
});

await step("Se juega la partida hasta el final y ambos ven el mismo resultado", async () => {
  for (let played = 0; !(await host.page.getByText("(Terminada)").count()); played += 10) {
    if (played > 80) throw new Error("la partida no termina");
    await playMoves(10);
  }
  await guest.page.getByText("(Terminada)").waitFor({ timeout: 15_000 });
  await sameState("al terminar la partida", 20_000);
  await host.page.screenshot({ path: `${OUT}final-host.png` });
  await guest.page.screenshot({ path: `${OUT}final-guest.png` });
});

// ── Resumen ──────────────────────────────────────────────────────────────────

async function finish(code) {
  log("──────────────── resumen ────────────────");
  for (const result of results) log(`${result.ok ? "PASS" : "FAIL"}  ${result.title}`);
  if (pageErrors.length) {
    log(`Errores de consola/página (${pageErrors.length}):`);
    for (const error of [...new Set(pageErrors)].slice(0, 15)) log(`  ${error}`);
  }
  await browser.close();
  await server?.close();
  process.exit(code);
}

await finish(results.every((result) => result.ok) ? 0 : 1);
