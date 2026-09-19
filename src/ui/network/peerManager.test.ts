import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, NetworkMessage } from "../../game";
import {
  buildPeerOptions,
  NetworkManager,
  parseExtraIceServers,
} from "./peerManager";
import type { ConnectionLike, ConnectionStatus, PeerFactory, PeerLike } from "./peerManager";

// ── Doble de PeerJS en memoria ───────────────────────────────────────────────
// Emula lo justo del servidor de señalización y del canal de datos: registro de IDs,
// "peer-unavailable", cierre de conexiones y entrega asíncrona de eventos y mensajes.

type Listener = (...args: never[]) => void;

class Emitter {
  private listeners = new Map<string, Listener[]>();

  on(event: string, callback: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]);
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) (listener as (...a: unknown[]) => void)(...args);
  }
}

const later = (fn: () => void) => void Promise.resolve().then(fn);

class FakeConnection extends Emitter implements ConnectionLike {
  open = false;
  metadata?: unknown;
  other: FakeConnection | null = null;

  send(data: unknown) {
    const other = this.other;
    if (!this.open || !other) return;
    const copy = structuredClone(data);
    later(() => other.emit("data", copy));
  }

  close() {
    const other = this.other;
    const wasOpen = this.open;
    this.other = null;
    this.open = false;
    later(() => this.emit("close"));
    if (other) {
      other.other = null;
      other.open = false;
      // Como en PeerJS real: si se cierra antes de abrir, el otro extremo no se entera nunca
      // (queda colgado esperando). Solo un canal ya abierto notifica el cierre.
      if (wasOpen) later(() => other.emit("close"));
    }
  }
}

class FakePeer extends Emitter implements PeerLike {
  destroyed = false;
  reconnectCalls = 0;
  private connections: FakeConnection[] = [];

  constructor(
    private readonly net: FakeNetwork,
    readonly id: string,
  ) {
    super();
    later(() => {
      if (this.destroyed) return;
      const holder = net.peers.get(id);
      if (holder && !holder.destroyed) {
        this.emit("error", Object.assign(new Error(`ID "${id}" is taken`), { type: "unavailable-id" }));
        return;
      }
      net.peers.set(id, this);
      this.emit("open", id);
    });
  }

  connect(targetId: string, options?: { reliable?: boolean; metadata?: unknown }): ConnectionLike {
    const local = new FakeConnection();
    local.metadata = options?.metadata;
    this.connections.push(local);
    later(() => {
      if (this.destroyed) return;
      const target = this.net.peers.get(targetId);
      if (!target || target.destroyed) {
        this.emit(
          "error",
          Object.assign(new Error(`Could not connect to peer ${targetId}`), { type: "peer-unavailable" }),
        );
        return;
      }
      const remote = new FakeConnection();
      remote.metadata = options?.metadata;
      local.other = remote;
      remote.other = local;
      target.connections.push(remote);
      target.emit("connection", remote);
      if (!remote.other) return; // el anfitrión la rechazó
      local.open = true;
      remote.open = true;
      local.emit("open");
      remote.emit("open");
    });
    return local;
  }

  reconnect() {
    this.reconnectCalls += 1;
  }

  destroy() {
    this.destroyed = true;
    if (this.net.peers.get(this.id) === this) this.net.peers.delete(this.id);
    this.connections.forEach((connection) => connection.close());
  }

  /** Simula que se perdió la señalización (el WebSocket con el servidor). */
  loseSignalling() {
    this.emit("disconnected");
  }

  /** Corta las conexiones de datos como si se hubiera caído la red, sin destruir el peer. */
  dropConnections() {
    this.connections.forEach((connection) => connection.close());
  }
}

class FakeNetwork {
  peers = new Map<string, FakePeer>();
  private counter = 0;

  factory: PeerFactory = (id) => new FakePeer(this, id ?? `guest-${(this.counter += 1)}`);

  peer(id: string): FakePeer {
    const peer = this.peers.get(id);
    if (!peer) throw new Error(`no hay peer ${id}`);
    return peer;
  }
}

// ── Utilidades de test ───────────────────────────────────────────────────────

function recorder() {
  const statuses: ConnectionStatus[] = [];
  const messages: NetworkMessage[] = [];
  const texts: string[] = [];
  return {
    statuses,
    messages,
    texts,
    last: () => statuses[statuses.length - 1],
    callbacks: {
      onStatusChange: (status: ConnectionStatus, message?: string) => {
        statuses.push(status);
        texts.push(message ?? "");
      },
      onMessage: (message: NetworkMessage) => messages.push(message),
    },
  };
}

/** Deja correr los eventos pendientes (microtareas y temporizadores) hasta `ms` milisegundos. */
async function advance(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 5; i += 1) await vi.advanceTimersByTimeAsync(0);
}

const HOST_ID = "wingspread-sala-1-host";
// Un mensaje válido para cada dirección: el anfitrión solo recibe GUEST_JOIN/APPLY_MOVE y el invitado SYNC_STATE.
const toHost: NetworkMessage = { type: "GUEST_JOIN", guestName: "Ana" };
const toGuest: NetworkMessage = { type: "SYNC_STATE", state: { round: 1 } as unknown as GameState };

describe("NetworkManager", () => {
  let net: FakeNetwork;
  let managers: NetworkManager[];

  const manager = () => {
    const created = new NetworkManager(net.factory);
    managers.push(created);
    return created;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    sessionStorage.clear();
    net = new FakeNetwork();
    managers = [];
  });

  afterEach(() => {
    managers.forEach((created) => created.cleanup());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function connectedPair() {
    const host = manager();
    const guest = manager();
    const hostLog = recorder();
    const guestLog = recorder();
    host.initHost("sala-1", hostLog.callbacks);
    await advance();
    guest.initGuest("sala-1", guestLog.callbacks);
    await advance();
    return { host, guest, hostLog, guestLog };
  }

  describe("conexión básica", () => {
    it("el anfitrión espera, el invitado se conecta y ambos intercambian mensajes", async () => {
      const host = manager();
      const hostLog = recorder();
      host.initHost("sala-1", hostLog.callbacks);
      await advance();
      expect(hostLog.last()).toBe("waiting_for_opponent");

      const guest = manager();
      const guestLog = recorder();
      guest.initGuest("sala-1", guestLog.callbacks);
      await advance();
      expect(hostLog.last()).toBe("connected");
      expect(guestLog.last()).toBe("connected");

      expect(guest.sendMessage({ type: "GUEST_JOIN", guestName: "Ana" })).toBe(true);
      expect(host.sendMessage({ type: "SYNC_STATE", state: { round: 1 } as unknown as GameState })).toBe(true);
      await advance();
      expect(hostLog.messages).toEqual([{ type: "GUEST_JOIN", guestName: "Ana" }]);
      expect(guestLog.messages).toEqual([{ type: "SYNC_STATE", state: { round: 1 } }]);
    });

    it("sendMessage devuelve false cuando no hay conexión abierta", async () => {
      const host = manager();
      host.initHost("sala-1", recorder().callbacks);
      await advance();
      expect(host.sendMessage(toGuest)).toBe(false);
      expect(host.isConnected()).toBe(false);
    });

    it("cada lado ignora los mensajes que no le corresponden o que vienen mal formados", async () => {
      const { host, guest, hostLog, guestLog } = await connectedPair();

      guest.sendMessage({ type: "SYNC_STATE", state: {} as GameState }); // solo el anfitrión sincroniza
      host.sendMessage({ type: "APPLY_MOVE", move: { type: "rerollFeeder" }, playerId: "nico" }); // solo el invitado mueve
      guest.sendMessage({ type: "BOGUS" } as unknown as NetworkMessage);
      guest.sendMessage(null as unknown as NetworkMessage);
      guest.sendMessage("hola" as unknown as NetworkMessage);
      guest.sendMessage(toHost);
      host.sendMessage(toGuest);
      await advance();

      expect(hostLog.messages).toEqual([toHost]);
      expect(guestLog.messages).toEqual([toGuest]);
    });
  });

  describe("recarga del invitado", () => {
    it("recupera su asiento aunque la conexión vieja todavía figure abierta", async () => {
      const { host, guest, hostLog } = await connectedPair();
      const before = hostLog.statuses.length;

      // El invitado recarga la página: el sessionStorage conserva su token. La conexión anterior
      // sigue "abierta" para el anfitrión (WebRTC tarda en detectar el corte).
      const reloaded = manager();
      const reloadedLog = recorder();
      reloaded.initGuest("sala-1", reloadedLog.callbacks);
      await advance();

      expect(reloadedLog.last()).toBe("connected");
      expect(hostLog.statuses.slice(before)).not.toContain("waiting_for_opponent");
      expect(hostLog.last()).toBe("connected");

      reloaded.sendMessage({ type: "GUEST_JOIN", guestName: "Ana" });
      host.sendMessage(toGuest);
      await advance();
      expect(hostLog.messages).toContainEqual({ type: "GUEST_JOIN", guestName: "Ana" });
      expect(reloadedLog.messages).toContainEqual(toGuest);
      guest.cleanup(); // la página vieja ya no existe
    });

    it("un intruso con otro token no le quita el asiento, pero puede ocuparlo si queda libre", async () => {
      const { host, guest, hostLog, guestLog } = await connectedPair();

      sessionStorage.clear(); // otro navegador: token distinto
      const intruder = manager();
      const intruderLog = recorder();
      intruder.initGuest("sala-1", intruderLog.callbacks);
      await advance();

      host.sendMessage(toGuest);
      await advance();
      expect(guestLog.messages).toEqual([toGuest]); // el invitado original sigue conectado
      expect(intruderLog.messages).toEqual([]);

      // Al intruso se le avisa (no queda colgado) y no insiste en reintentar por su cuenta.
      expect(intruderLog.last()).toBe("error");
      expect(intruderLog.texts[intruderLog.texts.length - 1]).toContain("otro invitado");
      const statusesAfterError = intruderLog.statuses.length;
      await advance(60_000);
      expect(intruderLog.statuses.length).toBe(statusesAfterError);

      // El invitado original se va y el asiento queda libre: si la persona pulsa "Reintentar", entra.
      guest.cleanup();
      await advance();
      expect(hostLog.last()).toBe("waiting_for_opponent");
      intruder.initGuest("sala-1", intruderLog.callbacks);
      await advance();
      expect(hostLog.last()).toBe("connected");
      expect(intruderLog.last()).toBe("connected");
    });

    it("quien se queda sin asiento no deja peers abiertos", async () => {
      await connectedPair();
      sessionStorage.clear();
      const intruder = manager();
      intruder.initGuest("sala-1", recorder().callbacks);
      await advance(5_000);

      expect(net.peers.size).toBe(2); // solo el anfitrión y el invitado original
    });
  });

  describe("reconexión", () => {
    it("el invitado vuelve a conectarse solo si se corta la conexión", async () => {
      const { host, guest, hostLog, guestLog } = await connectedPair();

      net.peer(HOST_ID).dropConnections();
      await advance();
      expect(hostLog.last()).toBe("waiting_for_opponent");
      expect(guestLog.last()).toBe("connecting");
      expect(guest.isConnected()).toBe(false);

      await advance(1000);
      expect(hostLog.last()).toBe("connected");
      expect(guestLog.last()).toBe("connected");

      host.sendMessage(toGuest);
      guest.sendMessage(toHost);
      await advance();
      expect(guestLog.messages).toEqual([toGuest]);
      expect(hostLog.messages).toEqual([toHost]);
    });

    it("si nunca llegó a conectar (sala inexistente) se rinde tras pocos intentos", async () => {
      const guest = manager();
      const log = recorder();
      guest.initGuest("no-existe", log.callbacks);
      await advance();
      expect(log.last()).toBe("connecting");

      await advance(1000 + 2000);
      expect(log.last()).toBe("error");
      expect(log.texts[log.texts.length - 1]).toContain("No se pudo conectar a la sala no-existe");
    });

    it("tras haber conectado insiste durante ~47 s antes de rendirse", async () => {
      const { host, guestLog } = await connectedPair();
      host.cleanup(); // el anfitrión desaparece
      await advance(20_000);
      expect(guestLog.last()).toBe("connecting");

      await advance(40_000);
      expect(guestLog.last()).toBe("error");
    });

    it("cleanup cancela los reintentos pendientes", async () => {
      const { guest, guestLog } = await connectedPair();
      net.peer(HOST_ID).dropConnections();
      await advance();
      const statusesBefore = guestLog.statuses.length;

      guest.cleanup();
      await advance(60_000);
      expect(guestLog.statuses.length).toBe(statusesBefore);
      expect(net.peers.size).toBe(1); // solo queda el peer del anfitrión
    });

    it("el anfitrión recupera la señalización si se cae el servidor", async () => {
      const host = manager();
      const log = recorder();
      host.initHost("sala-1", log.callbacks);
      await advance();

      const peer = net.peer(HOST_ID);
      peer.loseSignalling();
      await advance(999);
      expect(peer.reconnectCalls).toBe(0);
      await advance(1);
      expect(peer.reconnectCalls).toBe(1);
      expect(log.last()).toBe("connecting");
    });
  });

  describe("reanudar una sala", () => {
    it("el anfitrión que reanuda reintenta mientras el servidor tenga el ID ocupado", async () => {
      const stale = new FakePeer(net, HOST_ID); // la sesión anterior, aún registrada
      await advance();

      const host = manager();
      const log = recorder();
      host.initHost("sala-1", log.callbacks, { resume: true });
      await advance();
      expect(log.last()).toBe("connecting");
      expect(log.texts[log.texts.length - 1]).toContain("sigue registrada");

      stale.destroy();
      await advance(2000);
      expect(log.last()).toBe("waiting_for_opponent");
    });

    it("sin reanudar, un ID ocupado es un error (código repetido)", async () => {
      new FakePeer(net, HOST_ID);
      await advance();

      const host = manager();
      const log = recorder();
      host.initHost("sala-1", log.callbacks);
      await advance();
      expect(log.last()).toBe("error");
      expect(log.texts[log.texts.length - 1]).toContain("Ya existe una sala");
    });
  });
});

describe("configuración ICE", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("acepta una lista JSON de servidores y descarta valores inválidos", () => {
    const turn = { urls: "turn:turn.example.com:3478", username: "u", credential: "p" };
    expect(parseExtraIceServers(JSON.stringify([turn]))).toEqual([turn]);
    expect(parseExtraIceServers(undefined)).toEqual([]);
    expect(parseExtraIceServers("")).toEqual([]);
    expect(parseExtraIceServers("no es json")).toEqual([]);
    expect(parseExtraIceServers('{"urls":"stun:x"}')).toEqual([]);
    expect(parseExtraIceServers('[{"sin":"urls"}]')).toEqual([]);
  });

  it("agrega los servidores extra a los que ya trae PeerJS en vez de reemplazarlos", () => {
    const base = buildPeerOptions([]).config?.iceServers ?? [];
    expect(base.length).toBeGreaterThan(0);

    const extra = { urls: "turn:turn.example.com:3478" };
    expect(buildPeerOptions([extra]).config?.iceServers).toEqual([...base, extra]);
  });
});

