/**
 * Shows the toast of a return from the GitHub connect, on any page.
 * The API callback adds `github=connected` or `github_error=<code>` to the
 * builder URL, or to `/dashboard` when it has no builder URL to return to.
 * routes/__root.tsx calls it once, through the app-builder barrel.
 */
import { useRouter } from "@tanstack/react-router";
import {
	GITHUB_CONNECTED_PARAM,
	GITHUB_ERROR_PARAM,
	githubCallbackErrorCodeSchema,
} from "@wandit/contracts";
import { useEffect } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";

// The effect can run again before the URL change lands, for example in the
// React dev double run or when the locale loads. One toast id keeps one toast on screen.
const GITHUB_RETURN_TOAST_ID = "github-connect-return";

/** Reads the GitHub return params, shows the toast, and removes the params, so a reload shows no second toast. */
export function useGithubReturnToast(): void {
	const router = useRouter();
	const { t } = useTranslation();

	useEffect(() => {
		const search = new URLSearchParams(window.location.search);
		const isConnected = search.get(GITHUB_CONNECTED_PARAM) === "connected";
		// An unknown code is not from our callback, so it gets no toast.
		const error = githubCallbackErrorCodeSchema.safeParse(
			search.get(GITHUB_ERROR_PARAM),
		);
		if (!isConnected && !error.success) return;
		if (error.success) {
			toast.error(t(`appBuilder.github.callbackErrors.${error.data}`), {
				id: GITHUB_RETURN_TOAST_ID,
			});
		} else {
			toast.success(t("appBuilder.github.connectedToast"), {
				id: GITHUB_RETURN_TOAST_ID,
			});
		}
		search.delete(GITHUB_CONNECTED_PARAM);
		search.delete(GITHUB_ERROR_PARAM);
		const nextSearch = search.toString();
		router.history.replace(
			`${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`,
			router.history.location.state,
		);
	}, [router, t]);
}
