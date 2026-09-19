import Peer, { util } from "peerjs";
import type { PeerOptions } from "peerjs";
import type { NetworkMessage } from "../../game";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "";
}

const birdWords = [
  "halcon",
  "garza",
  "tucan",
  "condor",
  "colibri",
  "buho",
  "gull",
  "plover",
  "jay",
  "robin",
  "eagle",
  "finch",
];

export function generateRoomCode(): string {
  const word = birdWords[Math.floor(Math.random() * birdWords.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word}-${num}`;
}

/**
 * Interpreta lo que el jugador escribió/pegó en el campo de "código de sala": puede ser
 * un código simple (ej. "halcon-482") o un enlace completo compartido (ej.
 * "https://wingspread.vercel.app/?room=halcon-482"). Devuelve siempre el código normalizado
 * (minúsculas, sin espacios), o "" si no se pudo reconocer nada útil.
 */
export function extractRoomCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const looksLikeLink = /^https?:\/\//i.test(trimmed) || trimmed.includes("room=") || trimmed.includes("join=");
  if (looksLikeLink) {
    try {
      const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
      const fromParam = url.searchParams.get("room") || url.searchParams.get("join");
      if (fromParam) return fromParam.trim().toLowerCase();
      return "";
    } catch {
      return "";
    }
  }

  return trimmed.toLowerCase();
}

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "waiting_for_opponent"
  | "connected"
  | "error";

export interface NetworkCallbacks {
  onStatusChange: (status: ConnectionStatus, message?: string) => void;
  onMessage: (message: NetworkMessage) => void;
}

// ── Lo mínimo de PeerJS que usa NetworkManager ───────────────────────────────
// Se define como interfaz para poder reemplazar PeerJS por un doble en los tests.

export type PeerError = Error & { type?: string };

export interface ConnectionLike {
  open: boolean;
  metadata?: unknown;
  on(event: "open" | "close", callback: () => void): void;
  on(event: "data", callback: (data: unknown) => void): void;
  on(event: "error", callback: (error: Error) => void): void;
  send(data: unknown): void;
  close(): void;
}

export interface PeerLike {
  on(event: "open", callback: (id: string) => void): void;
  on(event: "connection", callback: (connection: ConnectionLike) => void): void;
  on(event: "disconnected" | "close", callback: () => void): void;
  on(event: "error", callback: (error: PeerError) => void): void;
  connect(id: string, options?: { reliable?: boolean; metadata?: unknown }): ConnectionLike;
  reconnect(): void;
  destroy(): void;
}

export type PeerFactory = (id: string | undefined, options: PeerOptions) => PeerLike;

const defaultPeerFactory: PeerFactory = (id, options) =>
  (id === undefined ? new Peer(options) : new Peer(id, options)) as unknown as PeerLike;

// ── Configuración ICE ────────────────────────────────────────────────────────

/**
 * Servidores ICE extra desde VITE_ICE_SERVERS (JSON, p. ej. un TURN propio):
 *   [{"urls":"turn:turn.midominio.com:3478","username":"u","credential":"p"}]
 * Se AÑADEN a los de PeerJS (un STUN de Google y TURN públicos de peerjs.com), no los reemplazan.
 */
export function parseExtraIceServers(raw: unknown): RTCIceServer[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((server) => typeof server === "object" && server !== null && "urls" in server)
    ) {
      return parsed as RTCIceServer[];
    }
  } catch {
    // cae al aviso de abajo
  }
  console.warn("VITE_ICE_SERVERS no es un JSON válido (lista de {urls, username?, credential?}): se ignora.");
  return [];
}

export function buildPeerOptions(
  extraIceServers: RTCIceServer[] = parseExtraIceServers(import.meta.env.VITE_ICE_SERVERS),
): PeerOptions {
  return {
    debug: 1,
    config: { ...util.defaultConfig, iceServers: [...util.defaultConfig.iceServers, ...extraIceServers] },
  };
}

// ── Identidad del invitado y validación de mensajes ─────────────────────────

const memoryTokens = new Map<string, string>();

function newToken(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Token que identifica a este invitado en una sala. Sobrevive a recargar la pestaña
 * (sessionStorage), así el anfitrión reconoce que es el mismo y le reasigna su asiento.
 */
function getGuestToken(roomCode: string): string {
  const key = `wingspread.guest.${roomCode}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const fresh = newToken();
    sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    // Almacenamiento bloqueado: el token vive solo mientras la página siga abierta.
    let token = memoryTokens.get(roomCode);
    if (!token) {
      token = newToken();
      memoryTokens.set(roomCode, token);
    }
    return token;
  }
}

function tokenOf(metadata: unknown): string | null {
  const token = (metadata as { token?: unknown } | null | undefined)?.token;
  return typeof token === "string" && token !== "" ? token : null;
}

/** Cada lado solo acepta los mensajes que le corresponde recibir. */
const HOST_ACCEPTS = new Set<NetworkMessage["type"]>(["GUEST_JOIN", "APPLY_MOVE", "PING"]);
const GUEST_ACCEPTS = new Set<NetworkMessage["type"]>(["SYNC_STATE", "RESTART_GAME", "ROOM_FULL", "PING"]);

// ── Reintentos ───────────────────────────────────────────────────────────────

/** Intentos de reconexión del invitado si ya había estado conectado (1+2+4+8+8+... s ≈ 47 s). */
const GUEST_RECONNECT_ATTEMPTS = 8;
/** Si nunca llegó a conectar (código mal escrito, sala inexistente) se rinde enseguida. */
const GUEST_FIRST_CONNECT_ATTEMPTS = 2;
const GUEST_MAX_DELAY_MS = 8000;
/** Al reanudar una sala, el servidor puede seguir teniendo registrado el ID anterior unos segundos. */
const HOST_RESUME_RETRY_MS = 2000;
const HOST_RESUME_ATTEMPTS = 15;

const NETWORK_ERROR_TYPES = new Set(["network", "server-error", "socket-error", "socket-closed", "webrtc"]);

export interface HostOptions {
  /** Reanuda una sala existente (p. ej. tras recargar): reintenta si el ID sigue ocupado. */
  resume?: boolean;
}

export class NetworkManager {
  private peer: PeerLike | null = null;
  private connection: ConnectionLike | null = null;
  private isHost = false;
  private roomCode = "";
  private callbacks: NetworkCallbacks | null = null;
  /** Anfitrión: token del dueño del asiento de invitado. Invitado: el token propio. */
  private guestToken: string | null = null;
  /** Se incrementa al abrir/cerrar un peer para ignorar eventos tardíos de los anteriores. */
  private session = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private everConnected = false;
  private peerOpen = false;
  private resumeHost = false;

  constructor(private readonly createPeer: PeerFactory = defaultPeerFactory) {}

  // ── Anfitrión ──────────────────────────────────────────────────────────────

  public initHost(roomCode: string, callbacks: NetworkCallbacks, options: HostOptions = {}) {
    this.cleanup();
    this.isHost = true;
    this.roomCode = roomCode;
    this.callbacks = callbacks;
    this.resumeHost = options.resume ?? false;
    this.openHostPeer();
  }

  private openHostPeer() {
    const session = ++this.session;
    const alive = () => session === this.session;
    this.peerOpen = false;
    this.status(
      "connecting",
      this.attempts === 0 ? "Creando sala en el servidor de señalización..." : "Recuperando la sala...",
    );

    let peer: PeerLike;
    try {
      peer = this.createPeer(`wingspread-${this.roomCode}-host`, buildPeerOptions());
    } catch (err: unknown) {
      this.status("error", errorMessage(err) || "Error al inicializar Host");
      return;
    }
    this.peer = peer;

    peer.on("open", () => {
      if (!alive()) return;
      this.peerOpen = true;
      this.attempts = 0;
      if (this.connection?.open) return;
      this.status("waiting_for_opponent", "Sala creada. Esperando a que el invitado se conecte...");
    });

    peer.on("connection", (conn) => {
      if (alive()) this.acceptGuest(conn);
    });

    peer.on("error", (err) => {
      if (!alive()) return;
      console.error("PeerJS Host error:", err);
      if (err.type === "unavailable-id" && this.resumeHost && this.attempts < HOST_RESUME_ATTEMPTS) {
        // El servidor todavía tiene registrada la sesión anterior: se libera en unos segundos.
        this.attempts += 1;
        this.status(
          "connecting",
          `La sala sigue registrada en el servidor, reintentando... (${this.attempts}/${HOST_RESUME_ATTEMPTS})`,
        );
        this.session += 1;
        this.destroyPeer();
        this.later(() => this.openHostPeer(), HOST_RESUME_RETRY_MS);
        return;
      }
      if (err.type === "unavailable-id") {
        this.status("error", "Ya existe una sala con ese código. Probá con otro.");
      } else if (this.peerOpen && err.type && NETWORK_ERROR_TYPES.has(err.type)) {
        // Se cayó la señalización pero la sala ya existe: "disconnected" se encarga de reconectar.
        return;
      } else {
        this.status("error", `Error de conexión: ${err.message}`);
      }
    });

    peer.on("disconnected", () => {
      if (!alive()) return;
      // Sin señalización nadie nuevo puede unirse (ni reconectarse): se recupera sola.
      if (!this.connection?.open) this.status("connecting", "Reconectando con el servidor de señalización...");
      this.later(() => {
        if (!alive()) return;
        try {
          peer.reconnect();
        } catch {
          // ya destruido
        }
      }, 1000);
    });
  }

  private acceptGuest(conn: ConnectionLike) {
    const token = tokenOf(conn.metadata);
    const current = this.connection;
    if (current?.open) {
      if (token !== null && token === this.guestToken) {
        // El mismo invitado volvió (recargó o perdió la red) y la conexión vieja todavía figura
        // abierta: se reemplaza. Se suelta primero para que su cierre no dispare avisos.
        this.connection = null;
        current.close();
      } else {
        this.rejectGuest(conn);
        return;
      }
    }
    if (token !== null) this.guestToken = token;
    this.connection = conn;
    this.setupConnection(conn);
  }

  /**
   * Rechaza a alguien que intenta sentarse en un asiento ocupado. Cerrar la conexión sin más deja
   * a esa persona colgada en "buscando sala" (el canal ni llega a abrirse): se le avisa por el
   * canal en cuanto abre y solo entonces se cierra.
   */
  private rejectGuest(conn: ConnectionLike) {
    const notify = () => {
      try {
        conn.send({ type: "ROOM_FULL" } satisfies NetworkMessage);
      } catch {
        // si no se pudo avisar, igual se cierra
      }
      this.later(() => conn.close(), 500);
    };
    if (conn.open) notify();
    else conn.on("open", notify);
  }

  // ── Invitado ───────────────────────────────────────────────────────────────

  public initGuest(roomCode: string, callbacks: NetworkCallbacks) {
    this.cleanup();
    this.isHost = false;
    this.roomCode = roomCode;
    this.callbacks = callbacks;
    this.guestToken = getGuestToken(roomCode);
    this.openGuestPeer();
  }

  private openGuestPeer() {
    const session = ++this.session;
    const alive = () => session === this.session;
    this.destroyPeer();

    const hostPeerId = `wingspread-${this.roomCode}-host`;
    this.status(
      "connecting",
      this.attempts === 0
        ? `Buscando sala ${this.roomCode}...`
        : `Reconectando con la sala ${this.roomCode}... (intento ${this.attempts} de ${this.maxGuestAttempts()})`,
    );

    let peer: PeerLike;
    try {
      peer = this.createPeer(undefined, buildPeerOptions());
    } catch (err: unknown) {
      this.status("error", errorMessage(err) || "Error al inicializar Invitado");
      return;
    }
    this.peer = peer;

    peer.on("open", () => {
      if (!alive()) return;
      const conn = peer.connect(hostPeerId, { reliable: true, metadata: { token: this.guestToken } });
      this.connection = conn;
      this.setupConnection(conn);
    });

    peer.on("error", (err) => {
      if (!alive()) return;
      console.error("PeerJS Guest error:", err);
      const retryable =
        err.type === "peer-unavailable" || (err.type !== undefined && NETWORK_ERROR_TYPES.has(err.type));
      if (retryable) this.scheduleGuestReconnect(err.message);
      else this.status("error", `No se pudo conectar a la sala ${this.roomCode}: ${err.message}`);
    });

    // Si solo se cae la señalización, la conexión de datos ya establecida sigue funcionando.
    peer.on("disconnected", () => {});
  }

  private maxGuestAttempts(): number {
    return this.everConnected ? GUEST_RECONNECT_ATTEMPTS : GUEST_FIRST_CONNECT_ATTEMPTS;
  }

  private scheduleGuestReconnect(reason?: string) {
    if (this.isHost || !this.callbacks || this.retryTimer) return;
    if (this.attempts >= this.maxGuestAttempts()) {
      this.status("error", `No se pudo conectar a la sala ${this.roomCode}${reason ? `: ${reason}` : "."}`);
      return;
    }
    const delay = Math.min(1000 * 2 ** this.attempts, GUEST_MAX_DELAY_MS);
    this.attempts += 1;
    this.status(
      "connecting",
      `Reconectando con la sala ${this.roomCode}... (intento ${this.attempts} de ${this.maxGuestAttempts()})`,
    );
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.openGuestPeer();
    }, delay);
    this.timers.add(this.retryTimer);
  }

  // ── Conexión de datos (ambos lados) ────────────────────────────────────────

  private setupConnection(conn: ConnectionLike) {
    const current = () => this.connection === conn;

    conn.on("open", () => {
      if (!current()) return;
      this.attempts = 0;
      this.everConnected = true;
      this.status("connected", "¡Conectado con el oponente!");
    });

    conn.on("data", (data: unknown) => {
      if (!current() || !this.callbacks) return;
      const type = (data as { type?: unknown } | null)?.type;
      const accepted = this.isHost ? HOST_ACCEPTS : GUEST_ACCEPTS;
      if (typeof type !== "string" || !accepted.has(type as NetworkMessage["type"])) return;
      if (type === "ROOM_FULL") {
        this.giveUpBecauseRoomIsFull();
        return;
      }
      this.callbacks.onMessage(data as NetworkMessage);
    });

    conn.on("close", () => {
      if (!current()) return;
      this.connection = null;
      if (this.isHost) {
        this.status("waiting_for_opponent", "El invitado se desconectó. Esperando a que vuelva...");
      } else {
        this.scheduleGuestReconnect("se perdió la conexión con el anfitrión");
      }
    });

    conn.on("error", (err) => {
      if (!current()) return;
      this.status("error", `Error en el canal de datos: ${err.message}`);
      if (!this.isHost) this.scheduleGuestReconnect(err.message);
    });
  }

  /** El anfitrión nos rechazó: reintentar no sirve (el asiento sigue ocupado), así que se corta y se avisa. */
  private giveUpBecauseRoomIsFull() {
    const callbacks = this.callbacks;
    this.session += 1;
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.retryTimer = null;
    this.destroyPeer();
    callbacks?.onStatusChange(
      "error",
      "La sala ya tiene otro invitado conectado. Si eras tú desde otra pestaña, ciérrala e inténtalo de nuevo.",
    );
  }

  /** Devuelve false si no hay conexión abierta (el mensaje NO se envió). */
  public sendMessage(msg: NetworkMessage): boolean {
    if (this.connection?.open) {
      this.connection.send(msg);
      return true;
    }
    return false;
  }

  public isConnected(): boolean {
    return this.connection?.open ?? false;
  }

  public cleanup() {
    this.session += 1; // los eventos que lleguen de lo que se cierra ahora se ignoran
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.retryTimer = null;
    this.destroyPeer();
    this.callbacks = null;
    this.guestToken = null;
    this.attempts = 0;
    this.everConnected = false;
    this.peerOpen = false;
    this.resumeHost = false;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  private destroyPeer() {
    if (this.connection) {
      const conn = this.connection;
      this.connection = null;
      conn.close();
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  private status(status: ConnectionStatus, message?: string) {
    this.callbacks?.onStatusChange(status, message);
  }

  private later(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }
}

export const networkManager = new NetworkManager();
