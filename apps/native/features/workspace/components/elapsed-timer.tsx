import { useEffect, useState } from "react";
import { Text } from "react-native";

type ElapsedTimerFormat = "clock" | "compact";

/**
 * Live elapsed readout seeded from an ISO timestamp (web parity with the
 * page-build/connector clocks and the MCP row timer). Two formats:
 * - "clock": `m:ss` — page builds, connector cards, video renders.
 * - "compact": `0.8s` under 10 s, `42s` under a minute, then `1:07` —
 *   the MCP row format, ticking at 250 ms.
 * Callers must key the component by `since` so a retry resets the clock.
 */
export function ElapsedTimer({
	since,
	format = "clock",
	className,
	color,
}: {
	since: string;
	format?: ElapsedTimerFormat;
	className?: string;
	color?: string;
}) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const interval = setInterval(
			() => setNow(Date.now()),
			format === "compact" ? 250 : 1000,
		);
		return () => clearInterval(interval);
	}, [format]);

	const startedAt = new Date(since).getTime();
	const elapsedMs = Number.isFinite(startedAt)
		? Math.max(0, now - startedAt)
		: 0;

	return (
		<Text
			className={className}
			style={[{ writingDirection: "ltr" }, color ? { color } : null]}
		>
			{format === "compact" ? formatCompact(elapsedMs) : formatClock(elapsedMs)}
		</Text>
	);
}

export function formatClock(elapsedMs: number): string {
	const totalSeconds = Math.floor(elapsedMs / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatCompact(elapsedMs: number): string {
	if (elapsedMs < 10_000) return `${(elapsedMs / 1000).toFixed(1)}s`;
	if (elapsedMs < 60_000) return `${Math.floor(elapsedMs / 1000)}s`;
	return formatClock(elapsedMs);
}
