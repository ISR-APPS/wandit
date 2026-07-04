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
	registerAuthRedirectHandler,
	sanitizeAuthRedirectPath,
} from "@/lib/auth-navigation";
import { authClient } from "../lib/auth-client";
import { AUTH_COPY } from "../lib/constants";
import { promptStash } from "../lib/prompt-stash";
import { invalidateSessionCache, useSession } from "../lib/session";

type AuthModalOpenOptions = {
	next?: string;
	redirectError?: boolean;
};

type AuthModalContextValue = {
	open: (opts?: AuthModalOpenOptions) => void;
	requireAuth: (then: () => void) => void;
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

/**
 * Returns a `requireAuth(then)` continuation runner: with a session, `then`
 * runs immediately; without one, the modal starts Google redirect auth and any
 * cross-page prompt handoff is handled through promptStash.
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
	const googleRedirectStartedRef = useRef(false);
	const { data: session } = useSession();
	const sessionRef = useRef(session);
	sessionRef.current = session;

	const open = useCallback((opts?: AuthModalOpenOptions) => {
		setNextPath(sanitizeAuthRedirectPath(opts?.next));
		setRedirectError(opts?.redirectError ?? false);
		googleRedirectStartedRef.current = false;
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
		promptStash.consume();
		googleRedirectStartedRef.current = false;
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
			const next = getCurrentPathname();
			open({ next: next === "/" ? undefined : next });
		});
	}, [open]);

	useEffect(() => {
		if (isOpen && session) {
			handleSignedIn();
		}
	}, [handleSignedIn, isOpen, session]);

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
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			setIsGoogleLoading(false);
			setError(null);
			return;
		}

		if (redirectError) {
			setError(AUTH_COPY.redirectError);
		}
	}, [open, redirectError]);

	const handleGoogle = async () => {
		if (isGoogleLoading) return;

		setError(null);
		setIsGoogleLoading(true);
		onGoogleRedirectStart();
		invalidateSessionCache();

		const destination = nextPath && nextPath !== "/" ? nextPath : "/dashboard";
		const callbackURL = `${window.location.origin}${destination}`;
		const errorCallbackURL = `${window.location.origin}/?auth=error`;

		try {
			const result = await authClient.signIn.social({
				provider: "google",
				callbackURL,
				errorCallbackURL,
			});

			if (result.error) {
				onGoogleRedirectEnd();
				setError(result.error.message || AUTH_COPY.googleError);
				setIsGoogleLoading(false);
				return;
			}

			if (result.data?.url) {
				window.location.assign(result.data.url);
			}
		} catch (err) {
			onGoogleRedirectEnd();
			setError(err instanceof Error ? err.message : AUTH_COPY.googleError);
			setIsGoogleLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
				<div className="flex flex-col px-6 pt-10 pb-6">
					<DialogHeader className="items-center gap-2 text-center sm:text-center">
						<Logo size="md" className="mb-2" />
						<DialogTitle className="font-display font-semibold text-xl tracking-tight">
							{AUTH_COPY.modalTitle}
						</DialogTitle>
						<DialogDescription className="text-muted-foreground text-sm">
							{AUTH_COPY.modalSubtitle}
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
								? AUTH_COPY.googleLoading
								: AUTH_COPY.googleButton}
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
						{AUTH_COPY.terms}
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function getCurrentPathname(): string | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}

	return sanitizeAuthRedirectPath(window.location.pathname);
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
