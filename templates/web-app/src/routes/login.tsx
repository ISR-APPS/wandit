// Public login route. Supabase email magic link, client-side only logic.
// On success the email link returns to /app.
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useT } from "~/i18n";
import { getSupabase } from "~/lib/supabase";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

type LoginState = "idle" | "sending" | "sent" | "error";

function LoginPage() {
	const { t } = useT();
	const [state, setState] = useState<LoginState>("idle");

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setState("sending");
		const email = String(
			new FormData(event.currentTarget).get("email") ?? "",
		).trim();
		const { error } = await getSupabase().auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: `${window.location.origin}/app`,
			},
		});
		setState(error ? "error" : "sent");
	}

	return (
		<div className="flex min-h-svh items-center justify-center bg-background px-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>{t("login.title")}</CardTitle>
					<CardDescription>{t("login.subtitle")}</CardDescription>
				</CardHeader>
				<CardContent>
					{state === "sent" ? (
						<div className="grid gap-2 text-center">
							<p className="font-medium">{t("login.sentTitle")}</p>
							<p className="text-muted-foreground text-sm">
								{t("login.sentBody")}
							</p>
						</div>
					) : (
						<form onSubmit={onSubmit} className="grid gap-4">
							<div className="grid gap-2">
								<Label htmlFor="login-email">{t("login.email")}</Label>
								<Input
									id="login-email"
									name="email"
									type="email"
									required
									autoComplete="email"
									placeholder={t("login.emailPlaceholder")}
								/>
							</div>
							{state === "error" && (
								<p className="text-destructive text-sm" role="alert">
									{t("login.error")}
								</p>
							)}
							<Button type="submit" disabled={state === "sending"}>
								{state === "sending" ? t("login.sending") : t("login.submit")}
							</Button>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
