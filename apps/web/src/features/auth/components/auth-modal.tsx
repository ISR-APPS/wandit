import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { cn } from "@wandit/ui/lib/utils";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
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
import { AUTH_COPY, MOCK_AUTH } from "../lib/constants";
import { signInMock, useSession } from "../lib/session";

type AuthModalContextValue = {
	open: () => void;
	requireAuth: (then: () => void) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal(): { open: () => void } {
	const ctx = useContext(AuthModalContext);
	if (!ctx)
		throw new Error("useAuthModal must be used within AuthModalProvider");
	return { open: ctx.open };
}

/**
 * Returns a `requireAuth(then)` continuation runner: with a session, `then`
 * runs immediately; without one, the auth modal opens and `then` runs right
 * after a successful sign-in.
 */
export function useRequireAuth(): (then: () => void) => void {
	const ctx = useContext(AuthModalContext);
	if (!ctx)
		throw new Error("useRequireAuth must be used within AuthModalProvider");
	return ctx.requireAuth;
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const pendingRef = useRef<(() => void) | null>(null);
	const { data: session } = useSession();
	const sessionRef = useRef(session);
	sessionRef.current = session;

	const open = useCallback(() => setIsOpen(true), []);

	const requireAuth = useCallback((then: () => void) => {
		if (sessionRef.current) {
			then();
			return;
		}
		pendingRef.current = then;
		setIsOpen(true);
	}, []);

	const handleSignedIn = useCallback(() => {
		const pending = pendingRef.current;
		pendingRef.current = null;
		pending?.();
		setIsOpen(false);
	}, []);

	const handleOpenChange = useCallback((next: boolean) => {
		setIsOpen(next);
		if (!next) pendingRef.current = null; // dismissed → drop continuation
	}, []);

	const value = useMemo(() => ({ open, requireAuth }), [open, requireAuth]);

	return (
		<AuthModalContext.Provider value={value}>
			{children}
			<AuthModalDialog
				open={isOpen}
				onOpenChange={handleOpenChange}
				onSignedIn={handleSignedIn}
			/>
		</AuthModalContext.Provider>
	);
}

type AuthStep = "start" | "sent";

function AuthModalDialog({
	open,
	onOpenChange,
	onSignedIn,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSignedIn: () => void;
}) {
	const [step, setStep] = useState<AuthStep>("start");
	const [email, setEmail] = useState("");
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const completeTimerRef = useRef<number | null>(null);

	const clearCompleteTimer = useCallback(() => {
		if (completeTimerRef.current !== null) {
			window.clearTimeout(completeTimerRef.current);
			completeTimerRef.current = null;
		}
	}, []);

	// Reset to a clean slate whenever the modal closes.
	useEffect(() => {
		if (!open) {
			setStep("start");
			setEmail("");
			setIsGoogleLoading(false);
			setIsSending(false);
			clearCompleteTimer();
		}
		return clearCompleteTimer;
	}, [open, clearCompleteTimer]);

	const handleGoogle = async () => {
		if (isGoogleLoading) return;
		setIsGoogleLoading(true);
		try {
			await signInMock("google");
			onSignedIn();
		} finally {
			setIsGoogleLoading(false);
		}
	};

	const handleMagicLink = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (isSending || email.trim().length === 0) return;
		setIsSending(true);
		// Simulated send latency, then the "check your inbox" state.
		await new Promise((r) => setTimeout(r, 450));
		setIsSending(false);
		setStep("sent");
		if (MOCK_AUTH) {
			// Mock: the "link" is clicked for you shortly after.
			completeTimerRef.current = window.setTimeout(() => {
				void signInMock("magic-link").then(onSignedIn);
			}, 1600);
		}
	};

	const handleBack = () => {
		clearCompleteTimer();
		setStep("start");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
				{step === "start" ? (
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

						<div className="mt-6 flex flex-col gap-4">
							<Button
								type="button"
								variant="outline"
								className="h-10 w-full"
								disabled={isGoogleLoading}
								onClick={handleGoogle}
							>
								{isGoogleLoading ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<GoogleIcon className="size-4" />
								)}
								{AUTH_COPY.googleButton}
							</Button>

							<div className="flex items-center gap-3">
								<div className="h-px flex-1 bg-border" />
								<span className="text-muted-foreground text-xs uppercase tracking-widest">
									{AUTH_COPY.divider}
								</span>
								<div className="h-px flex-1 bg-border" />
							</div>

							<form className="flex flex-col gap-2" onSubmit={handleMagicLink}>
								<Label htmlFor="auth-email" className="sr-only">
									{AUTH_COPY.emailLabel}
								</Label>
								<Input
									id="auth-email"
									type="email"
									required
									autoComplete="email"
									placeholder={AUTH_COPY.emailPlaceholder}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									disabled={isSending}
									className="h-10"
								/>
								<Button
									type="submit"
									variant="secondary"
									className="h-10 w-full"
									disabled={isSending || email.trim().length === 0}
								>
									{isSending ? (
										<Loader2 className="size-4 animate-spin" />
									) : null}
									{AUTH_COPY.sendMagicLink}
								</Button>
							</form>
						</div>

						<p className="mt-6 text-center text-muted-foreground/80 text-xs leading-relaxed">
							{AUTH_COPY.terms}
						</p>
					</div>
				) : (
					<div className="flex flex-col items-center px-6 pt-10 pb-8 text-center">
						<span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
							<MailCheck className="size-5" />
						</span>
						<DialogHeader className="mt-4 items-center gap-2 text-center sm:text-center">
							<DialogTitle className="font-display font-semibold text-xl tracking-tight">
								{AUTH_COPY.sentTitle}
							</DialogTitle>
							<DialogDescription className="text-muted-foreground text-sm">
								{AUTH_COPY.sentBody}
							</DialogDescription>
						</DialogHeader>
						<p className="mt-1 font-mono text-foreground text-sm">{email}</p>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="mt-6 text-muted-foreground"
							onClick={handleBack}
						>
							<ArrowLeft className="size-3.5" />
							{AUTH_COPY.useDifferentEmail}
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
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
