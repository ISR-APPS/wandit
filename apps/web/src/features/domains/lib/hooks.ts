import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useDebouncedValue<TValue>(value: TValue, delayMs: number) {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);
		return () => window.clearTimeout(timeoutId);
	}, [delayMs, value]);

	return debounced;
}

export function useCopyToClipboard(successMessage: string) {
	return async (value: string) => {
		await navigator.clipboard.writeText(value);
		toast.success(successMessage);
	};
}
