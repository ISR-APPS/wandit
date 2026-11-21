// The screens of the access gate: the page of an account that waits, its skeleton, and its error state.
// The /app layout route renders each one in place of the app shell. Only an approved account gets the shell.
// They read no data: the route gives the status. Sign-out uses the mutation of the auth feature.
import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useSignOutMutation } from "~/features/auth";
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

type GateCardProps = {
	/** The card title, already translated. It is the only h1 of the screen. */
	title: string;
	/** One or two sentences under the title, already translated. */
	description: string;
	/** Email of the signed-in account, so the person sees which account waits. The error state has none. */
	email?: string;
	/** The main button of the card. Sign out follows it. */
	action: ReactNode;
};

/** The full-screen card of the gate, with the layout of the login page. Each gate screen ends with Sign out. */
function GateCard({ title, description, email, action }: GateCardProps) {
	const { t } = useT();
	const signOut = useSignOutMutation();

	return (
		<div className="relative flex min-h-svh items-center justify-center bg-background px-6">
			{/* The shell does not render here, so this screen carries the language switcher, as the login page does. */}
			<div className="absolute end-6 top-6">
				<LocaleSwitcher />
			</div>
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>
						<h1>{title}</h1>
					</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					{email ? (
						<p dir="auto" className="truncate text-muted-foreground text-sm">
							{email}
						</p>
					) : null}
					<div className="flex flex-wrap gap-2">
						{action}
						<Button
							type="button"
							variant="outline"
							disabled={signOut.isPending}
							onClick={() =>
								signOut.mutate(undefined, {
									onError: () => toast.error(t("shell.signOutError")),
								})
							}
						>
							{t("common.signOut")}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

type AccessPendingPageProps = {
	/** Status of the caller's `app_access` row. The route renders this page for each status except "approved". */
	status: "pending" | "refused";
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
};

/** The page of an account that the owner did not approve. It shows in place of the app shell. */
export function AccessPendingPage({ status, email }: AccessPendingPageProps) {
	const { t } = useT();
	return (
		<GateCard
			title={
				status === "refused"
					? t("appAccess.refusedTitle")
					: t("appAccess.pendingTitle")
			}
			description={t("appAccess.askOwner")}
			email={email}
			action={
				// A full reload, not a refetch. For 30 s, the query cache keeps the empty pages that a waiting account loaded.
				<Button type="button" onClick={() => window.location.reload()}>
					{t("appAccess.checkAgain")}
				</Button>
			}
		/>
	);
}

/**
 * Placeholder while the access read runs. The /app layout route sets it as pendingComponent.
 * The server renders it for /app, because that route has `ssr: false`. So it uses no browser API.
 */
export function AccessCheckSkeleton() {
	return (
		<div className="flex min-h-svh items-center justify-center bg-background px-6">
			<div className="grid w-full max-w-sm gap-3">
				<Skeleton className="h-6 w-2/3" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-9 w-32" />
			</div>
		</div>
	);
}

/**
 * Error state of the /app layout: the access read failed, or the account has no `app_access` row.
 * It shows in place of the app shell. Retry runs the guard and the loader again.
 * It also catches the error of a child route that has no errorComponent, so its text names no cause.
 */
export function AccessCheckError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<GateCard
			title={t("common.appName")}
			description={t("appAccess.checkError")}
			action={
				<Button type="button" onClick={() => router.invalidate()}>
					{t("common.retry")}
				</Button>
			}
		/>
	);
}
