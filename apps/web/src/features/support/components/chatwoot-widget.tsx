import { useEffect, useRef } from "react";

import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/lib/i18n";

import { useChatIdentity } from "../api/support.queries";
import {
	isChatwootConfigured,
	loadChatwoot,
	setSupportChatBubbleVisible,
	whenChatwootReady,
} from "../lib/chatwoot";

type ChatwootWidgetProps = {
	// Signed-in user id from the `_auth` route context. Passed in (rather than
	// read via `@/features/auth`) so auth → support → auth never forms a
	// barrel import cycle: `signOut()` calls `resetSupportChat()`.
	userId: string | null;
};

// Renders nothing. Loads the Chatwoot widget once, identifies the signed-in
// user with the server-signed hash, and keeps locale + theme in sync.
// Mounted inside the `_auth` layout so public pages never show the bubble.
export function ChatwootWidget({ userId }: ChatwootWidgetProps) {
	const { locale, dir } = useI18n();
	const { resolvedTheme } = useTheme();
	const { data: identity } = useChatIdentity(userId);
	const identifiedUserIdRef = useRef<string | null>(null);

	// 1. Load once. The SDK reads position/locale a single time at run(), so
	//    they come from the values at first mount (RTL → bubble on the left).
	//    The SDK's DOM nodes outlive this component, so hide the bubble on
	//    unmount (e.g. navigating to a public page while signed in).
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
	useEffect(() => {
		if (!isChatwootConfigured) {
			return;
		}
		loadChatwoot({
			locale,
			position: dir === "rtl" ? "left" : "right",
			darkMode: "auto",
			showUnreadMessagesDialog: true,
		});
		setSupportChatBubbleVisible(true);
		return () => setSupportChatBubbleVisible(false);
	}, []);

	// 2. Widget language follows the app switcher (en / fr / ar). Chatwoot
	//    flips the widget to RTL for Arabic on its own.
	useEffect(() => {
		if (!isChatwootConfigured) {
			return;
		}
		return whenChatwootReady((api) => api.setLocale(locale));
	}, [locale]);

	// 3. Widget colors follow the app mode toggle, not only the OS.
	useEffect(() => {
		if (!isChatwootConfigured) {
			return;
		}
		return whenChatwootReady((api) =>
			api.setColorScheme?.(resolvedTheme === "dark" ? "dark" : "light"),
		);
	}, [resolvedTheme]);

	// 4. Identify the user once per user id. setUser needs at least one of
	//    name / email / avatar_url, and is only reliable after chatwoot:ready.
	useEffect(() => {
		if (
			!isChatwootConfigured ||
			!identity ||
			!userId ||
			identifiedUserIdRef.current === userId
		) {
			return;
		}
		return whenChatwootReady((api) => {
			api.setUser(identity.identifier, {
				...(identity.name ? { name: identity.name } : {}),
				...(identity.email ? { email: identity.email } : {}),
				...(identity.avatarUrl ? { avatar_url: identity.avatarUrl } : {}),
				...(identity.identifierHash
					? { identifier_hash: identity.identifierHash }
					: {}),
			});
			identifiedUserIdRef.current = userId;
		});
	}, [identity, userId]);

	return null;
}
