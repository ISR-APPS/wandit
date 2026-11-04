/**
 * The frame and the shared states of the OAuth pages /oauth/authorize and /oauth/consent.
 * The two pages of this feature render it. It loads no image and no script from the client.
 */
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { Button } from "@wandit/ui/components/button";
import type * as React from "react";

import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { isRefusedOAuthRequest } from "../api/coding-agents.services";

/** The centered card of an OAuth page. It fits a phone screen. */
export function OAuthCard({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
			<section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
				{children}
			</section>
		</main>
	);
}

/** A state with a title, a body, and an optional action, for example "You can close this tab". */
export function OAuthMessage({
	title,
	body,
	action,
}: {
	title: string;
	body: string;
	/** A button under the body, for example "Try again". */
	action?: React.ReactNode;
}) {
	return (
		<OAuthCard>
			<div className="text-center">
				<h1 className="font-display font-semibold text-2xl tracking-tight">
					{title}
				</h1>
				<p className="mt-3 text-muted-foreground text-sm">{body}</p>
				{action ? <div className="mt-6">{action}</div> : null}
			</div>
		</OAuthCard>
	);
}

/** The spinner state while the page waits for the API. */
export function OAuthPending({ label }: { label: string }) {
	return (
		<OAuthCard>
			<div className="flex flex-col items-center gap-4 text-center">
				<CircleNotchIcon
					aria-hidden
					className="size-6 animate-spin text-muted-foreground"
				/>
				<p className="text-muted-foreground text-sm">{label}</p>
			</div>
		</OAuthCard>
	);
}

/** The dead end for a request that the API cannot continue: expired, changed, or from an unknown client. */
export function InvalidOAuthRequest() {
	const { t } = useTranslation();
	return (
		<OAuthMessage
			title={t("auth.codingAgents.request.invalidTitle")}
			body={t("auth.codingAgents.request.invalidBody")}
		/>
	);
}

/** The state after a failed call. A refused request is a dead end. Another failure, such as the network, can retry. */
export function OAuthRequestFailed({
	error,
	onRetry,
}: {
	/** The error of the failed query or mutation. */
	error: Error;
	onRetry: () => void;
}) {
	const { t } = useTranslation();
	if (isRefusedOAuthRequest(error)) {
		return <InvalidOAuthRequest />;
	}
	return (
		<OAuthMessage
			title={t("auth.codingAgents.request.failedTitle")}
			body={getApiErrorMessage(error)}
			action={
				<Button className="h-11 rounded-full px-6" onClick={onRetry}>
					{t("auth.codingAgents.request.retry")}
				</Button>
			}
		/>
	);
}
