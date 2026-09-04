import { roundCreditAmount } from "@/lib/credit-format";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
});

const wholeNumberFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 0,
});

const compactTokenFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 1,
	notation: "compact",
});

const creditsFormatter = new Intl.NumberFormat("en-US", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 6,
});

export function formatConversationDateTime(value: string | null): string {
	return value ? dateTimeFormatter.format(new Date(value)) : "No activity";
}

export function formatConversationRelativeTime(
	value: string | null,
	nowMs = Date.now(),
): string {
	if (!value) {
		return "No activity";
	}

	const timestampMs = Date.parse(value);
	if (!Number.isFinite(timestampMs)) {
		return "No activity";
	}

	const elapsedMinutes = Math.max(
		Math.floor((nowMs - timestampMs) / 60_000),
		0,
	);

	if (elapsedMinutes < 1) {
		return "Just now";
	}

	if (elapsedMinutes < 60) {
		return `${elapsedMinutes}m ago`;
	}

	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) {
		return `${elapsedHours}h ago`;
	}

	const elapsedDays = Math.floor(elapsedHours / 24);
	if (elapsedDays < 7) {
		return `${elapsedDays}d ago`;
	}

	const elapsedWeeks = Math.floor(elapsedDays / 7);
	if (elapsedWeeks < 5) {
		return `${elapsedWeeks}w ago`;
	}

	return dateFormatter.format(new Date(timestampMs));
}

export function formatConversationCount(value: number | null): string {
	return value === null ? "—" : wholeNumberFormatter.format(value);
}

export function formatConversationTokenCount(value: number | null): string {
	return value === null
		? "—"
		: compactTokenFormatter.format(value).toLocaleLowerCase("en-US");
}

export function formatCentiCredits(value: number | null): string {
	return value === null
		? "—"
		: creditsFormatter.format(roundCreditAmount(value / 100));
}

export function formatConversationCost(value: number | null): string {
	return value === null ? "—" : usdFormatter.format(value);
}

export function formatUsdMicros(value: number | null): string {
	return value === null ? "—" : usdFormatter.format(value / 1_000_000);
}

export function titleCaseIdentifier(value: string): string {
	return value
		.replaceAll(/[_-]+/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
