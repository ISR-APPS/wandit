/**
 * The frame and the shared states of the OAuth pages /oauth/authorize and /oauth/consent.
 * The two pages of this feature render it. It loads no image and no script from the client.
 * The V2 look: a sand desk with a spark glow, a white card, and the night brand tile.
 */
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import type * as React from "react";

import { Spark } from "@/components/logo";
import {
	PANEL_HINT_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
} from "@/features/app-builder";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { isRefusedOAuthRequest } from "../api/coding-agents.services";

/** Title of an OAuth page, centered under the brand tile. The consent page uses it too. */
export const OAUTH_TITLE_CLASS =
	"text-center font-bold font-grotesk text-[1.5rem] text-night leading-tight tracking-[-0.03em] dark:text-foreground";

/**
 * The centered card of an OAuth page, with the Wandit brand tile at its top.
 * The tile shows the user that the page is a Wandit page. It fits a phone screen.
 */
export function OAuthCard({ children }: { children: React.ReactNode }) {
	return (
		// The sand desk of the builder workspace, with its spark glow at the top center.
		<main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(720px_340px_at_50%_-8%,rgb(250_171_63/0.22),transparent_70%)] bg-sand px-4 py-10 dark:bg-[radial-gradient(720px_340px_at_50%_-8%,rgb(209_96_34/0.14),transparent_70%)] dark:bg-background">
			<section className="w-full max-w-md rounded-[1.5rem] border border-night/[0.08] bg-white p-6 shadow-raised sm:p-8 dark:border-white/[0.08] dark:bg-sand">
				{/* The tile stays night in dark mode, so the amber drop of the dark key is off. */}
				<span
					aria-hidden
					className="mx-auto mb-5 grid size-11 place-items-center rounded-[14px] bg-night shadow-key dark:shadow-none dark:ring-1 dark:ring-white/10"
				>
					<Spark className="size-6 text-spark" />
				</span>
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
				<h1 className={OAUTH_TITLE_CLASS}>{title}</h1>
				<p className="mt-3 font-sans text-[14px] text-night/60 leading-relaxed dark:text-foreground/60">
					{body}
				</p>
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
					className="size-6 animate-spin text-ember motion-reduce:animate-none dark:text-spark"
				/>
				<p className={PANEL_HINT_CLASS}>{label}</p>
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
				<Button
					className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-11 px-6")}
					onClick={onRetry}
				>
					{t("auth.codingAgents.request.retry")}
				</Button>
			}
		/>
	);
}
