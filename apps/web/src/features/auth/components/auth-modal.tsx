import {
	identifyAnalyticsUser,
	resetAnalytics,
} from "@wandit/analytics/browser";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { cn } from "@wandit/ui/lib/utils";
import { Loader2 } from "lucide-react";
import type * as React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { Logo } from "@/components/logo";
import { LegalConsentSentence } from "@/features/legal/components/legal-consent-sentence";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import {
	buildAuthCallbackUrls,
	registerAuthRedirectHandler,
	sanitizeAuthRedirectPath,
} from "@/lib/auth-navigation";
import { useTranslation } from "@/lib/i18n";
import { authClient } from "../lib/auth-client";
import { promptStash } from "../lib/prompt-stash";
import { invalidateSessionCache, useSession } from "../lib/session";
import { EmailAuthSection } from "./email-auth-section";

type AuthModalOpenOptions = {
	next?: string;
	redirectError?: boolean;
};

type AuthModalContextValue = {
	open: (opts?: AuthModalOpenOptions) => void;
	requireAuth: (then: () => void) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

// Mirrors the server's magicLink `expiresIn` (packages/auth): once the emailed
// link is dead, a sent link no longer counts as a pending auth handoff.
const MAGIC_LINK_PENDING_MS = 10 * 60_000;

export function useAuthModal(): {
	open: (opts?: AuthModalOpenOptions) => void;
} {
	const ctx = useContext(AuthModalContext);
	if (!ctx)
		throw new Error("useAuthModal must be used within AuthModalProvider");
	return { open: ctx.open };
}

/**
 * Returns a `requireAuth(then)` continuation runner: with a session, `then`
 * runs immediately; without one, the modal starts Google redirect auth and any
 * cross-page prompt handoff is handled through promptStash on the dashboard.
 */
export function useRequireAuth(): (then: () => void) => void {
	const ctx = useContext(AuthModalContext);
	if (!ctx)
		throw new Error("useRequireAuth must be used within AuthModalProvider");
	return ctx.requireAuth;
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [nextPath, setNextPath] = useState<string | undefined>();
	const [redirectError, setRedirectError] = useState(false);
	// Auth handoffs in flight. Dismissing the modal during a handoff must not
	// clear the prompt stash — the completion still needs it. A Google redirect
	// ends when this page comes back (bfcache restore or a fresh open); a sent
	// magic link stays pending for the link's own lifetime. Both are tracked
	// separately so a failed Google attempt cannot forget a still-valid link.
	const googleRedirectPendingRef = useRef(false);
	const magicLinkSentAtRef = useRef<number | null>(null);
	const isAuthHandoffPending = useCallback(() => {
		if (googleRedirectPendingRef.current) return true;
		const sentAt = magicLinkSentAtRef.current;
		return sentAt !== null && Date.now() - sentAt <= MAGIC_LINK_PENDING_MS;
	}, []);
	const { data: session, isPending: isSessionPending } = useSession();
	const sessionRef = useRef(session);
	sessionRef.current = session;
	const userId = session?.user.id;
	const userEmail = session?.user.email;
	const userName = session?.user.name;
	const identifiedUserIdRef = useRef<string | null>(null);

	const open = useCallback((opts?: AuthModalOpenOptions) => {
		setNextPath(sanitizeAuthRedirectPath(opts?.next));
		setRedirectError(opts?.redirectError ?? false);
		// A fresh open means any Google redirect is over; an auth error means
		// the whole handoff failed.
		googleRedirectPendingRef.current = false;
		if (opts?.redirectError) {
			magicLinkSentAtRef.current = null;
		}
		setIsOpen(true);
	}, []);

	const requireAuth = useCallback(
		(then: () => void) => {
			if (sessionRef.current) {
				then();
				return;
			}

			open();
		},
		[open],
	);

	const handleSignedIn = useCallback(() => {
		invalidateSessionCache();
		googleRedirectPendingRef.current = false;
		magicLinkSentAtRef.current = null;
		setNextPath(undefined);
		setRedirectError(false);
		setIsOpen(false);
	}, []);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			setIsOpen(nextOpen);

			if (!nextOpen) {
				if (!isAuthHandoffPending()) {
					promptStash.consume();
				}
				setNextPath(undefined);
				setRedirectError(false);
			}
		},
		[isAuthHandoffPending],
	);

	const handleGoogleRedirectStart = useCallback(() => {
		googleRedirectPendingRef.current = true;
	}, []);

	const handleGoogleRedirectEnd = useCallback(() => {
		googleRedirectPendingRef.current = false;
	}, []);

	const handleMagicLinkPendingChange = useCallback((pending: boolean) => {
		magicLinkSentAtRef.current = pending ? Date.now() : null;
	}, []);

	// Back from the Google consent screen restores this page from the bfcache
	// with the redirect still marked pending — it is over at that point, so
	// re-arm normal dismiss cleanup. A sent magic link is unaffected: the
	// email is still valid after a Back navigation.
	useEffect(() => {
		const onPageShow = (event: PageTransitionEvent) => {
			if (event.persisted) {
				googleRedirectPendingRef.current = false;
			}
		};
		window.addEventListener("pageshow", onPageShow);
		return () => window.removeEventListener("pageshow", onPageShow);
	}, []);

	useEffect(() => {
		return registerAuthRedirectHandler(() => {
			const next = getCurrentReturnPath();
			open({ next: next === "/" ? undefined : next });
		});
	}, [open]);

	useEffect(() => {
		if (isSessionPending) return;

		if (!userId) {
			if (identifiedUserIdRef.current) {
				resetAnalytics();
			}
			identifiedUserIdRef.current = null;
			return;
		}

		if (identifiedUserIdRef.current !== userId) {
			if (identifiedUserIdRef.current) {
				resetAnalytics();
			}
			// Email and name are deliberate person properties for beta-support lookup.
			identifyAnalyticsUser(userId, {
				...(userEmail ? { email: userEmail } : {}),
				...(userName ? { name: userName } : {}),
			});
			identifiedUserIdRef.current = userId;
		}
	}, [isSessionPending, userEmail, userId, userName]);

	useEffect(() => {
		if (isOpen && session) {
			handleSignedIn();
		}
	}, [handleSignedIn, isOpen, session]);

	// A session that appears while the modal is closed (cross-tab sign-in)
	// also ends every pending handoff, so a later dismiss cleans up normally.
	useEffect(() => {
		if (userId) {
			googleRedirectPendingRef.current = false;
			magicLinkSentAtRef.current = null;
		}
	}, [userId]);

	const value = useMemo(() => ({ open, requireAuth }), [open, requireAuth]);

	return (
		<AuthModalContext.Provider value={value}>
			{children}
			<AuthModalDialog
				open={isOpen}
				nextPath={nextPath}
				redirectError={redirectError}
				onOpenChange={handleOpenChange}
				onGoogleRedirectStart={handleGoogleRedirectStart}
				onGoogleRedirectEnd={handleGoogleRedirectEnd}
				onMagicLinkPendingChange={handleMagicLinkPendingChange}
			/>
		</AuthModalContext.Provider>
	);
}

function AuthModalDialog({
	open,
	nextPath,
	redirectError,
	onOpenChange,
	onGoogleRedirectStart,
	onGoogleRedirectEnd,
	onMagicLinkPendingChange,
}: {
	open: boolean;
	nextPath: string | undefined;
	redirectError: boolean;
	onOpenChange: (open: boolean) => void;
	onGoogleRedirectStart: () => void;
	onGoogleRedirectEnd: () => void;
	onMagicLinkPendingChange: (pending: boolean) => void;
}) {
	const { t } = useTranslation();
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Back from the Google consent screen can restore this dialog from the
	// bfcache mid-"loading" — unfreeze the button so the user can retry.
	useEffect(() => {
		const onPageShow = (event: PageTransitionEvent) => {
			if (event.persisted) {
				setIsGoogleLoading(false);
			}
		};
		window.addEventListener("pageshow", onPageShow);
		return () => window.removeEventListener("pageshow", onPageShow);
	}, []);
	// Dark until the emailAuthEnabled product setting is flipped: without it
	// the dialog renders exactly the pre-email (Google-only) modal.
	const settingsQuery = usePublicSettingsQuery();
	const emailAuthEnabled = settingsQuery.data?.emailAuthEnabled === true;

	useEffect(() => {
		if (!open) {
			setIsGoogleLoading(false);
			setError(null);
			return;
		}

		if (redirectError) {
			setError(t("auth.redirectError"));
		}
	}, [open, redirectError, t]);

	const handleGoogle = async () => {
		if (isGoogleLoading) return;

		setError(null);
		setIsGoogleLoading(true);
		onGoogleRedirectStart();
		invalidateSessionCache();

		const destination = nextPath && nextPath !== "/" ? nextPath : "/dashboard";
		const { callbackURL, errorCallbackURL } = buildAuthCallbackUrls(
			window.location.origin,
			destination,
		);

		try {
			const result = await authClient.signIn.social({
				provider: "google",
				callbackURL,
				errorCallbackURL,
			});

			if (result.error) {
				onGoogleRedirectEnd();
				setError(result.error.message || t("auth.googleError"));
				setIsGoogleLoading(false);
				return;
			}

			if (result.data?.url) {
				window.location.assign(result.data.url);
			}
		} catch (err) {
			onGoogleRedirectEnd();
			setError(err instanceof Error ? err.message : t("auth.googleError"));
			setIsGoogleLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="gap-0 overflow-hidden p-0 sm:max-w-sm"
				closeLabel={t("common.close")}
			>
				<div className="flex flex-col px-6 pt-10 pb-6">
					<DialogHeader className="items-center gap-2 text-center sm:text-center">
						<Logo size="md" className="mb-2" />
						<DialogTitle className="font-display font-semibold text-xl tracking-tight">
							{t("auth.modalTitle")}
						</DialogTitle>
						<DialogDescription className="text-muted-foreground text-sm">
							{t("auth.modalSubtitle")}
						</DialogDescription>
					</DialogHeader>

					<div className="mt-6 flex flex-col gap-3">
						<Button
							type="button"
							className="h-11 w-full rounded-full"
							disabled={isGoogleLoading}
							onClick={handleGoogle}
						>
							{isGoogleLoading ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<GoogleIcon className="size-4" />
							)}
							{isGoogleLoading
								? t("auth.googleLoading")
								: t("auth.googleButton")}
						</Button>

						{emailAuthEnabled ? (
							<EmailAuthSection
								nextPath={nextPath}
								onError={setError}
								onClearError={() => setError(null)}
								onMagicLinkPendingChange={onMagicLinkPendingChange}
							/>
						) : null}

						{error ? (
							<p
								role="alert"
								className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-destructive text-sm leading-snug"
							>
								{error}
							</p>
						) : null}
					</div>

					<p className="mt-6 text-center text-muted-foreground/80 text-xs leading-relaxed">
						{/* This dialog is mounted at the app root, so a consent link
						    would change the route under a modal that stays open on
						    top of the document — close it on the way out. */}
						<LegalConsentSentence
							template={t("auth.terms")}
							termsLabel={t("auth.termsLink")}
							privacyLabel={t("auth.privacyLink")}
							onNavigate={() => onOpenChange(false)}
						/>
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function getCurrentReturnPath(): string | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}

	return sanitizeAuthRedirectPath(
		`${window.location.pathname}${window.location.search}`,
	);
}

function GoogleIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={cn(className)}>
			<path
				fill="#4285F4"
				d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
			/>
			<path
				fill="#34A853"
				d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
			/>
			<path
				fill="#FBBC05"
				d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z"
			/>
			<path
				fill="#EA4335"
				d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
			/>
		</svg>
	);
}
