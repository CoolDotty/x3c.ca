import NumberFlow from "@number-flow/react";
import type { Stats, ConnectionState } from "@/hooks/useServerStats";

interface ServerStatsDisplayProps {
  stats: Stats | null;
  connectionState: ConnectionState;
  className?: string;
}

function bytesToDisplay(bytes: number): { value: number; unit: string } {
  const tb = bytes / 1024 ** 4;
  if (tb >= 1) return { value: parseFloat(tb.toFixed(1)), unit: "TB" };
  const gb = bytes / 1024 ** 3;
  return { value: parseFloat(gb.toFixed(1)), unit: "GB" };
}

export default function ServerStatsDisplay({
  stats,
  connectionState,
  className,
}: ServerStatsDisplayProps) {
  return (
    <div
      className={`flex flex-col items-end gap-1 text-sm text-right ${className ?? ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-zinc-400">{connectionState}</span>
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
      </div>

      <div
        className={`flex flex-col items-end gap-1 pt-1 transition-opacity duration-500 ease-out ${
          stats ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-300">
            <NumberFlow
              value={stats?.cpu.usage ?? 0}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />
            %
          </span>
          <span className="text-zinc-500">CPU</span>
        </div>
        <div className="flex items-center gap-1.5">
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
          <span className="text-zinc-500">RAM</span>
        </div>
        <div className="flex items-center gap-1.5">
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
          <span className="text-zinc-500">Storage</span>
        </div>
      </div>
    </div>
  );
}
