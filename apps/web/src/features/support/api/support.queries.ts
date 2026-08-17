import { useQuery } from "@tanstack/react-query";

import { getChatIdentity } from "./support.services";

export const supportKeys = {
	all: ["support"] as const,
	chatIdentity: (userId: string) =>
		[...supportKeys.all, "chat-identity", userId] as const,
};

// One fetch per signed-in user. The hash only changes if the inbox HMAC
// token changes, so it never goes stale within a session.
export function useChatIdentity(userId: string | null) {
	return useQuery({
		queryKey: supportKeys.chatIdentity(userId ?? ""),
		queryFn: getChatIdentity,
		enabled: userId !== null,
		staleTime: Number.POSITIVE_INFINITY,
		retry: 1,
	});
}
