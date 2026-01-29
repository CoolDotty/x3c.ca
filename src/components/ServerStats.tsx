import { useEffect, useState } from "react";

interface Stats {
  cpu: { usage: number };
  ram: { total: number; used: number; usage: number };
  storage: { total: number; used: number; usage: number };
  timestamp: number;
}

interface ServerStatsProps {
  className?: string;
}

function formatBytes(bytes: number): string {
  const tb = bytes / (1024 ** 4);
  if (tb >= 1) return `${tb.toFixed(1)} TB`;
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(1)} GB`;
}

type ConnectionState = "connecting" | "connected" | "error";

export default function ServerStats({ className }: ServerStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

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

  return (
    <div className={`flex flex-col items-start gap-1 text-sm ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <span className="relative flex items-center justify-center size-3">
          <span
            className={`absolute inline-flex h-full w-full animate-ping duration-1000 rounded-full opacity-75 ${
              connectionState === "connected" ? "bg-green-400" : connectionState === "error" ? "bg-red-400" : "bg-zinc-500"
            }`}
          ></span>
          <span
            className={`relative inline-flex size-2 rounded-full ${
              connectionState === "connected" ? "bg-green-400" : connectionState === "error" ? "bg-red-400" : "bg-zinc-500"
            }`}
          ></span>
        </span>
        <span className="text-zinc-400">Server</span>
      </div>

      {stats ? (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">CPU</span>
            <span className="text-zinc-300">{stats.cpu.usage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">RAM</span>
            <span className="text-zinc-300">
              {formatBytes(stats.ram.used)} / {formatBytes(stats.ram.total)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Storage</span>
            <span className="text-zinc-300">
              {formatBytes(stats.storage.used)} / {formatBytes(stats.storage.total)}
            </span>
          </div>
        </>
      ) : (
        <span className="text-zinc-500">Connecting...</span>
      )}
    </div>
  );
}
