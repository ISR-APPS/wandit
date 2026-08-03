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
import {
	buildAuthCallbackUrls,
	registerAuthRedirectHandler,
	sanitizeAuthRedirectPath,
} from "@/lib/auth-navigation";
import { useTranslation } from "@/lib/i18n";
import { authClient } from "../lib/auth-client";
import { promptStash } from "../lib/prompt-stash";
import {
	invalidateSessionCache,
	refreshSession,
	useSession,
} from "../lib/session";

type AuthModalOpenOptions = {
	next?: string;
	redirectError?: boolean;
};

type AuthModalContextValue = {
	open: (opts?: AuthModalOpenOptions) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal(): {
	open: (opts?: AuthModalOpenOptions) => void;
} {
	const ctx = useContext(AuthModalContext);
	if (!ctx)
		throw new Error("useAuthModal must be used within AuthModalProvider");
	return { open: ctx.open };
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [nextPath, setNextPath] = useState<string | undefined>();
	const [redirectError, setRedirectError] = useState(false);
	const googleRedirectStartedRef = useRef(false);
	// Only auto-close after we observed "logged out" while the modal was open,
	// then a real session appeared. Prevents a stale Better Auth atom from
	// instantly closing a 401-triggered modal.
	const sawSignedOutWhileOpenRef = useRef(false);
	const openAttemptRef = useRef(0);
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
		googleRedirectStartedRef.current = false;
		sawSignedOutWhileOpenRef.current = !sessionRef.current;
		const attempt = openAttemptRef.current + 1;
		openAttemptRef.current = attempt;
		setIsOpen(true);
		// Drop stale "still signed in" memory from Better Auth after a 401.
		void refreshSession().then((fresh) => {
			if (openAttemptRef.current !== attempt) return;
			if (!fresh) {
				sawSignedOutWhileOpenRef.current = true;
			}
		});
	}, []);

	const handleSignedIn = useCallback(() => {
		invalidateSessionCache();
		// Dashboard owns prompt-stash restore after OAuth — do not consume here.
		googleRedirectStartedRef.current = false;
		sawSignedOutWhileOpenRef.current = false;
		setNextPath(undefined);
		setRedirectError(false);
		setIsOpen(false);
	}, []);

	const handleOpenChange = useCallback((nextOpen: boolean) => {
		setIsOpen(nextOpen);

		if (!nextOpen) {
			if (!googleRedirectStartedRef.current) {
				promptStash.consume();
			}
			googleRedirectStartedRef.current = false;
			sawSignedOutWhileOpenRef.current = false;
			setNextPath(undefined);
			setRedirectError(false);
		}
	}, []);

	const handleGoogleRedirectStart = useCallback(() => {
		googleRedirectStartedRef.current = true;
	}, []);

	const handleGoogleRedirectEnd = useCallback(() => {
		googleRedirectStartedRef.current = false;
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
		if (!isOpen) return;

		if (!session) {
			sawSignedOutWhileOpenRef.current = true;
			return;
		}

		if (sawSignedOutWhileOpenRef.current) {
			handleSignedIn();
		}
	}, [handleSignedIn, isOpen, session]);

	const value = useMemo(() => ({ open }), [open]);

	return (
		<AuthModalContext.Provider value={value}>
			{children}
			<AuthModalDialog
				key={isOpen ? "open" : "closed"}
				open={isOpen}
				nextPath={nextPath}
				redirectError={redirectError}
				onOpenChange={handleOpenChange}
				onGoogleRedirectStart={handleGoogleRedirectStart}
				onGoogleRedirectEnd={handleGoogleRedirectEnd}
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
}: {
	open: boolean;
	nextPath: string | undefined;
	redirectError: boolean;
	onOpenChange: (open: boolean) => void;
	onGoogleRedirectStart: () => void;
	onGoogleRedirectEnd: () => void;
}) {
	const { t } = useTranslation();
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [error, setError] = useState<string | null>(() =>
		redirectError ? t("auth.redirectError") : null,
	);

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
				disableRedirect: true,
			});

			if (result.error) {
				onGoogleRedirectEnd();
				setError(result.error.message || t("auth.googleError"));
				setIsGoogleLoading(false);
				return;
			}

			if (result.data?.url) {
				window.location.assign(result.data.url);
				return;
			}

			onGoogleRedirectEnd();
			setError(t("auth.googleError"));
			setIsGoogleLoading(false);
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
						{t("auth.terms")}
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
