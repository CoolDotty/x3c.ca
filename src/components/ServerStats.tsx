import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

interface Stats {
  cpu: { usage: number };
  ram: { total: number; used: number; usage: number };
  storage: { total: number; used: number; usage: number };
  timestamp: number;
}

interface ServerStatsProps {
  className?: string;
}

function bytesToDisplay(bytes: number): { value: number; unit: string } {
  const tb = bytes / 1024 ** 4;
  if (tb >= 1) return { value: parseFloat(tb.toFixed(1)), unit: "TB" };
  const gb = bytes / 1024 ** 3;
  return { value: parseFloat(gb.toFixed(1)), unit: "GB" };
}

type ConnectionState = "connecting" | "connected" | "error";

export default function ServerStats({ className }: ServerStatsProps) {
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

  return (
    <div
      className={`flex flex-col items-start gap-1 text-sm ${className ?? ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex items-center justify-center size-3">
          <span
            className={`absolute inline-flex h-full w-full animate-ping duration-1000 rounded-full opacity-75 ${
              connectionState === "connected"
                ? "bg-green-400"
                : connectionState === "error"
                  ? "bg-red-400"
                  : "bg-zinc-500"
            }`}
          ></span>
          <span
            className={`relative inline-flex size-2 rounded-full ${
              connectionState === "connected"
                ? "bg-green-400"
                : connectionState === "error"
                  ? "bg-red-400"
                  : "bg-zinc-500"
            }`}
          ></span>
        </span>
        <span className="text-zinc-400">{connectionState}</span>
      </div>

      <div
        className={`flex flex-col gap-1 pt-1 transition-opacity duration-500 ease-out ${
          stats ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">CPU</span>
          <span className="text-zinc-300">
            <NumberFlow
              value={stats?.cpu.usage ?? 0}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />
            %
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">RAM</span>
          <span className="text-zinc-300">
            <NumberFlow
              value={stats ? bytesToDisplay(stats.ram.used).value : 0}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />{" "}
            {stats && bytesToDisplay(stats.ram.used).unit} /{" "}
            <NumberFlow
              value={stats ? bytesToDisplay(stats.ram.total).value : 0}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />{" "}
            {stats && bytesToDisplay(stats.ram.total).unit}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Storage</span>
          <span className="text-zinc-300">
            <NumberFlow
              value={stats ? bytesToDisplay(stats.storage.used).value : 0}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />{" "}
            {stats && bytesToDisplay(stats.storage.used).unit} /{" "}
            <NumberFlow
              value={stats ? bytesToDisplay(stats.storage.total).value : 0}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />{" "}
            {stats && bytesToDisplay(stats.storage.total).unit}
          </span>
        </div>
      </div>
    </div>
  );
}
