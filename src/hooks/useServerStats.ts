import { useEffect, useRef, useState } from "react";

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

const STATS_WS_URL = "wss://stats.x3c.ca";
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export function useServerStats(): UseServerStatsReturn {
	const [stats, setStats] = useState<Stats | null>(null);
	const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
	const wsRef = useRef<WebSocket | null>(null);
	const intentionalCloseRef = useRef(false);
	const backoffRef = useRef(INITIAL_BACKOFF_MS);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		let mounted = true;

		const scheduleReconnect = () => {
			if (reconnectTimerRef.current !== null) return;
			const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS);
			backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
			reconnectTimerRef.current = setTimeout(() => {
				reconnectTimerRef.current = null;
				connect();
			}, delay);
		};

		const connect = () => {
			if (!mounted) return;
			const ws = new WebSocket(STATS_WS_URL);
			wsRef.current = ws;

			ws.onopen = () => {
				if (!mounted) return;
				backoffRef.current = INITIAL_BACKOFF_MS;
				setConnectionState("connected");
			};

			ws.onerror = () => {
				if (!mounted) return;
				setConnectionState("error");
			};

			ws.onclose = () => {
				if (!mounted) return;
				if (intentionalCloseRef.current) return;
				setConnectionState("connecting");
				scheduleReconnect();
			};

			ws.onmessage = (event) => {
				if (!mounted) return;
				try {
					const data = JSON.parse(event.data) as Stats;
					setStats(data);
					setConnectionState("connected");
					backoffRef.current = INITIAL_BACKOFF_MS;
				} catch (e) {
					console.error("Failed to parse stats:", e);
				}
			};
		};

		connect();

		return () => {
			mounted = false;
			intentionalCloseRef.current = true;
			if (reconnectTimerRef.current !== null) {
				clearTimeout(reconnectTimerRef.current);
				reconnectTimerRef.current = null;
			}
			if (wsRef.current) {
				wsRef.current.close();
				wsRef.current = null;
			}
		};
	}, []);

	return { stats, connectionState };
}
