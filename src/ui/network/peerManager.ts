import Peer, { DataConnection } from "peerjs";
import type { GameState, Move, NetworkMessage, PlayerId } from "../../game";

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

export class NetworkManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private isHost: boolean = false;
  private roomCode: string = "";
  private callbacks: NetworkCallbacks | null = null;

  public initHost(roomCode: string, callbacks: NetworkCallbacks) {
    this.cleanup();
    this.isHost = true;
    this.roomCode = roomCode;
    this.callbacks = callbacks;

    const hostPeerId = `wingspread-${roomCode}-host`;
    callbacks.onStatusChange("connecting", "Creando sala en el servidor de señalización...");

    try {
      this.peer = new Peer(hostPeerId, {
        debug: 1,
      });

      this.peer.on("open", () => {
        this.callbacks?.onStatusChange(
          "waiting_for_opponent",
          "Sala creada. Esperando a que el invitado se conecte...",
        );
      });

      this.peer.on("connection", (conn) => {
        // Accept incoming guest connection
        if (this.connection) {
          conn.close();
          return;
        }

        this.connection = conn;
        this.setupConnection(conn);
      });

      this.peer.on("error", (err) => {
        console.error("PeerJS Host error:", err);
        this.callbacks?.onStatusChange("error", `Error de conexión: ${err.message}`);
      });

      this.peer.on("disconnected", () => {
        this.callbacks?.onStatusChange("disconnected", "Desconectado del servidor.");
      });
    } catch (err: any) {
      this.callbacks?.onStatusChange("error", err?.message || "Error al inicializar Host");
    }
  }

  public initGuest(roomCode: string, callbacks: NetworkCallbacks) {
    this.cleanup();
    this.isHost = false;
    this.roomCode = roomCode;
    this.callbacks = callbacks;

    const hostPeerId = `wingspread-${roomCode}-host`;
    callbacks.onStatusChange("connecting", `Buscando sala ${roomCode}...`);

    try {
      this.peer = new Peer({
        debug: 1,
      });

      this.peer.on("open", () => {
        if (!this.peer) return;
        const conn = this.peer.connect(hostPeerId, {
          reliable: true,
        });

        this.connection = conn;
        this.setupConnection(conn);
      });

      this.peer.on("error", (err) => {
        console.error("PeerJS Guest error:", err);
        this.callbacks?.onStatusChange("error", `No se pudo conectar a la sala ${roomCode}: ${err.message}`);
      });

      this.peer.on("disconnected", () => {
        this.callbacks?.onStatusChange("disconnected", "Desconectado del servidor.");
      });
    } catch (err: any) {
      this.callbacks?.onStatusChange("error", err?.message || "Error al inicializar Invitado");
    }
  }

  private setupConnection(conn: DataConnection) {
    conn.on("open", () => {
      this.callbacks?.onStatusChange("connected", "¡Conectado con el oponente!");
    });

    conn.on("data", (data: any) => {
      if (this.callbacks && data && typeof data === "object" && "type" in data) {
        this.callbacks.onMessage(data as NetworkMessage);
      }
    });

    conn.on("close", () => {
      this.connection = null;
      this.callbacks?.onStatusChange("disconnected", "El oponente se ha desconectado.");
    });

    conn.on("error", (err) => {
      this.callbacks?.onStatusChange("error", `Error en el canal de datos: ${err.message}`);
    });
  }

  public sendMessage(msg: NetworkMessage) {
    if (this.connection && this.connection.open) {
      this.connection.send(msg);
    }
  }

  public cleanup() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.callbacks = null;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }
}

export const networkManager = new NetworkManager();
