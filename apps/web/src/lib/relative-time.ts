/**
 * Tiny relative-time formatter ("2h ago", "3d ago") — no date lib.
 * Future or just-now timestamps collapse to "just now".
 */
export function relativeTime(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	const seconds = Math.floor(ms / 1000);

	if (Number.isNaN(seconds) || seconds < 45) return "just now";

	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;

	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;

	const days = Math.round(hours / 24);
	if (days < 7) return `${days}d ago`;

	const weeks = Math.round(days / 7);
	if (weeks < 5) return `${weeks}w ago`;

	const months = Math.round(days / 30);
	if (months < 12) return `${months}mo ago`;

	return `${Math.round(days / 365)}y ago`;
}
