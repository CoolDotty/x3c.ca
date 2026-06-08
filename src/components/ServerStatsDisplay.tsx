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

function dotColor(state: ConnectionState): string {
	if (state === "connected") return "bg-green-400";
	if (state === "error") return "bg-red-400";
	return "bg-zinc-500";
}

export default function ServerStatsDisplay({
	stats,
	connectionState,
	className,
}: ServerStatsDisplayProps) {
	return (
		<div className={`flex flex-col items-end gap-1 text-right text-sm ${className ?? ""}`}>
			<div
				role="status"
				aria-live="polite"
				aria-label={`Server stats connection: ${connectionState}`}
				className="flex items-center gap-2"
			>
				<span className="text-zinc-400">{connectionState}</span>
				<span aria-hidden="true" className="relative flex size-3 items-center justify-center">
					<span
						className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 duration-1000 ${dotColor(
							connectionState
						)}`}
					></span>
					<span
						className={`relative inline-flex size-2 rounded-full ${dotColor(connectionState)}`}
					></span>
				</span>
			</div>

			<div
				aria-live="off"
				className={`flex flex-col items-end gap-1 pt-1 transition-opacity duration-500 ease-out ${
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
