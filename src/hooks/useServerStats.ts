import { useEffect, useState } from "react";

export interface Stats {
  cpu: { usage: number };
  ram: { total: number; used: number; usage: number };
  storage: { total: number; used: number; usage: number };
  timestamp: number;
}

export type ConnectionState = "connecting" | "connected" | "error";

export interface UseServerStatsReturn {
  stats: Stats | null;
  connectionState: ConnectionState;
}

export function useServerStats(): UseServerStatsReturn {
  const [stats, setStats] = useState<Stats | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  useEffect(() => {
    const ws = new WebSocket("wss://stats.x3c.ca");

    ws.onclose = () => setConnectionState("connecting");
    ws.onerror = () => setConnectionState("error");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Stats;
        setStats(data);
        setConnectionState("connected");
      } catch (e) {
        console.error("Failed to parse stats:", e);
      }
    };

    return () => ws.close();
  }, []);

  return { stats, connectionState };
}
