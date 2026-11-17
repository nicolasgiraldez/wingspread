import Peer, { util } from "peerjs";
import type { PeerOptions } from "peerjs";
import type { NetworkMessage, PlayerId } from "../../game";

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
  /** `from` es el asiento del invitado que lo envió (solo en el anfitrión). */
  onMessage: (message: NetworkMessage, from?: PlayerId) => void;
  /** Anfitrión: cambió qué invitados tienen la conexión abierta (alguien entró, volvió o se fue). */
  onPeersChange?: (connectedSeats: PlayerId[]) => void;
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
 * (sessionStorage), así el anfitrión reconoce que es el mismo y le devuelve su asiento.
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
const HOST_ACCEPTS = new Set<NetworkMessage["type"]>(["GUEST_JOIN", "APPLY_MOVE"]);
const GUEST_ACCEPTS = new Set<NetworkMessage["type"]>(["SYNC_STATE", "ROOM_FULL"]);

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

/** Asiento del único invitado de una sala de 2 jugadores (ver SEAT_IDS en hostGame.ts). */
const DEFAULT_GUEST_SEATS: PlayerId[] = ["santi"];

export interface HostOptions {
  /** Reanuda una sala existente (p. ej. tras recargar): reintenta si el ID sigue ocupado. */
  resume?: boolean;
  /** Asientos que pueden ocupar los invitados, en el orden en que se reparten (por defecto, uno solo). */
  guestSeats?: PlayerId[];
  /** Al reanudar: qué token ocupaba cada asiento, para que cada invitado vuelva al suyo. */
  seatTokens?: Record<PlayerId, string>;
}

export class NetworkManager {
  private peer: PeerLike | null = null;
  /** Invitado: su conexión con el anfitrión. */
  private connection: ConnectionLike | null = null;
  /** Anfitrión: la conexión de cada asiento de invitado (abierta o todavía abriéndose). */
  private connections = new Map<PlayerId, ConnectionLike>();
  private guestSeats: PlayerId[] = DEFAULT_GUEST_SEATS;
  /** Anfitrión: token del dueño de cada asiento, para devolvérselo si recarga o pierde la red. */
  private seatTokens = new Map<PlayerId, string>();
  private isHost = false;
  private roomCode = "";
  private callbacks: NetworkCallbacks | null = null;
  /** Invitado: el token propio. */
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
    this.guestSeats = options.guestSeats?.length ? [...options.guestSeats] : DEFAULT_GUEST_SEATS;
    for (const seat of this.guestSeats) {
      const token = options.seatTokens?.[seat];
      if (typeof token === "string" && token !== "") this.seatTokens.set(seat, token);
    }
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
      this.reportHostStatus();
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
      if (!this.allGuestsConnected()) this.status("connecting", "Reconectando con el servidor de señalización...");
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

  private isSeatOpen(seat: PlayerId): boolean {
    return this.connections.get(seat)?.open ?? false;
  }

  private allGuestsConnected(): boolean {
    return this.guestSeats.every((seat) => this.isSeatOpen(seat));
  }

  /** Invitados con la conexión abierta, en el orden de los asientos. */
  public connectedSeats(): PlayerId[] {
    return this.isHost ? this.guestSeats.filter((seat) => this.isSeatOpen(seat)) : [];
  }

  /** Token del dueño de cada asiento ya ocupado alguna vez (se guarda con la partida para reanudarla). */
  public getSeatTokens(): Record<PlayerId, string> {
    return Object.fromEntries(this.seatTokens);
  }

  /** Estado del anfitrión según cuántos invitados hay conectados. `left` = alguien acaba de irse. */
  private reportHostStatus(left = false) {
    if (!this.isHost || !this.peerOpen) return;
    const total = this.guestSeats.length;
    const connected = this.connectedSeats().length;
    if (connected === total) {
      this.status("connected", total === 1 ? "¡Conectado con el oponente!" : "¡Todos los jugadores están conectados!");
      return;
    }
    let message: string;
    if (total === 1) {
      message = left
        ? "El invitado se desconectó. Esperando a que vuelva..."
        : "Sala creada. Esperando a que el invitado se conecte...";
    } else if (left) {
      message = `Un jugador se desconectó (${connected} de ${total} invitados conectados). Esperando a que vuelva...`;
    } else if (connected === 0) {
      message = `Sala creada. Esperando a que se conecten los ${total} invitados...`;
    } else {
      message = `${connected} de ${total} invitados conectados. Esperando al resto...`;
    }
    this.status("waiting_for_opponent", message);
  }

  /**
   * Qué asiento le toca a quien se conecta: el suyo si ya tenía uno (lo reconoce por el token),
   * si no uno que nadie ocupó todavía, y si no el de alguien que se fue. null = sala completa.
   */
  private pickSeat(token: string | null): PlayerId | null {
    if (token !== null) {
      const own = this.guestSeats.find((seat) => this.seatTokens.get(seat) === token);
      if (own) return own;
    }
    const empty = this.guestSeats.filter((seat) => !this.connections.has(seat));
    return (
      empty.find((seat) => !this.seatTokens.has(seat)) ??
      empty[0] ??
      // Último recurso: un asiento cuya conexión nunca terminó de abrirse.
      this.guestSeats.find((seat) => !this.isSeatOpen(seat)) ??
      null
    );
  }

  private acceptGuest(conn: ConnectionLike) {
    const token = tokenOf(conn.metadata);
    const seat = this.pickSeat(token);
    if (seat === null) {
      this.rejectGuest(conn);
      return;
    }
    // Si el asiento tenía una conexión es la del mismo invitado, que volvió (recargó o perdió la
    // red) mientras la vieja todavía figura abierta, o una que nunca abrió: se reemplaza. Se suelta
    // primero para que su cierre no dispare avisos.
    const previous = this.connections.get(seat);
    if (previous) {
      this.connections.delete(seat);
      previous.close();
    }
    if (token !== null) this.seatTokens.set(seat, token);
    this.connections.set(seat, conn);
    this.setupHostConnection(seat, conn);
  }

  private setupHostConnection(seat: PlayerId, conn: ConnectionLike) {
    const current = () => this.connections.get(seat) === conn;

    conn.on("open", () => {
      if (!current()) return;
      this.everConnected = true;
      this.callbacks?.onPeersChange?.(this.connectedSeats());
      this.reportHostStatus();
    });

    conn.on("data", (data: unknown) => {
      if (!current() || !this.callbacks) return;
      const type = (data as { type?: unknown } | null)?.type;
      if (typeof type !== "string" || !HOST_ACCEPTS.has(type as NetworkMessage["type"])) return;
      this.callbacks.onMessage(data as NetworkMessage, seat);
    });

    conn.on("close", () => {
      if (!current()) return;
      this.connections.delete(seat);
      this.callbacks?.onPeersChange?.(this.connectedSeats());
      this.reportHostStatus(true);
    });

    conn.on("error", (err) => {
      if (!current()) return;
      // El canal de UN invitado falló: los demás siguen jugando. Si se cerró, "close" lo informa.
      console.warn(`Error en el canal de datos del asiento ${seat}:`, err);
    });
  }

  /**
   * Rechaza a alguien que intenta entrar a una sala completa. Cerrar la conexión sin más deja
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
      this.setupGuestConnection(conn);
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

  private setupGuestConnection(conn: ConnectionLike) {
    const current = () => this.connection === conn;

    conn.on("open", () => {
      if (!current()) return;
      this.attempts = 0;
      this.everConnected = true;
      this.status("connected", "¡Conectado con la sala!");
    });

    conn.on("data", (data: unknown) => {
      if (!current() || !this.callbacks) return;
      const type = (data as { type?: unknown } | null)?.type;
      if (typeof type !== "string" || !GUEST_ACCEPTS.has(type as NetworkMessage["type"])) return;
      if (type === "ROOM_FULL") {
        this.giveUpBecauseRoomIsFull();
        return;
      }
      this.callbacks.onMessage(data as NetworkMessage);
    });

    conn.on("close", () => {
      if (!current()) return;
      this.connection = null;
      this.scheduleGuestReconnect("se perdió la conexión con el anfitrión");
    });

    conn.on("error", (err) => {
      if (!current()) return;
      this.status("error", `Error en el canal de datos: ${err.message}`);
      this.scheduleGuestReconnect(err.message);
    });
  }

  /** El anfitrión nos rechazó: reintentar no sirve (la sala sigue completa), así que se corta y se avisa. */
  private giveUpBecauseRoomIsFull() {
    const callbacks = this.callbacks;
    this.session += 1;
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.retryTimer = null;
    this.destroyPeer();
    callbacks?.onStatusChange(
      "error",
      "La sala ya está completa: todos sus lugares tienen un jugador conectado. Si eras vos desde otra pestaña, cerrala e intentá de nuevo.",
    );
  }

  // ── Mensajes (ambos lados) ─────────────────────────────────────────────────

  /**
   * El invitado le escribe al anfitrión; el anfitrión, a todos los invitados conectados.
   * Devuelve false si no había ninguna conexión abierta (el mensaje NO se envió).
   */
  public sendMessage(msg: NetworkMessage): boolean {
    if (this.isHost) {
      let sent = false;
      for (const seat of this.connectedSeats()) sent = this.sendTo(seat, msg) || sent;
      return sent;
    }
    if (this.connection?.open) {
      this.connection.send(msg);
      return true;
    }
    return false;
  }

  /** Anfitrión: le escribe solo al invitado de ese asiento. false si no está conectado. */
  public sendTo(seat: PlayerId, msg: NetworkMessage): boolean {
    const conn = this.connections.get(seat);
    if (!conn?.open) return false;
    conn.send(msg);
    return true;
  }

  public isConnected(): boolean {
    return this.isHost ? this.connectedSeats().length > 0 : (this.connection?.open ?? false);
  }

  public cleanup() {
    this.session += 1; // los eventos que lleguen de lo que se cierra ahora se ignoran
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.retryTimer = null;
    this.destroyPeer();
    this.callbacks = null;
    this.guestToken = null;
    this.guestSeats = DEFAULT_GUEST_SEATS;
    this.seatTokens.clear();
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
    if (this.connections.size > 0) {
      const open = [...this.connections.values()];
      this.connections.clear();
      open.forEach((conn) => conn.close());
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
