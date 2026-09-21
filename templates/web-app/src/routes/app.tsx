// Route behind login. Rendered client-side only (ssr: false).
// Reads the session and the profiles row with the browser Supabase client.
// The save goes through saveProfileFn, a server function that writes under RLS.

import type { Session } from "@supabase/supabase-js";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
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
import { Skeleton } from "~/components/ui/skeleton";
import { useT } from "~/i18n";
import { saveProfileFn } from "~/lib/profile-server";
import { getSupabase } from "~/lib/supabase";

// The client ships no generated Database types; the row is checked at the boundary.
const profileRowSchema = z.object({ full_name: z.string().nullable() });

export const Route = createFileRoute("/app")({
	// Auth state lives in the browser, so this route never renders on the server.
	ssr: false,
	component: AppPage,
});

function AppPage() {
	const { t } = useT();
	const navigate = useNavigate();
	const [session, setSession] = useState<Session | null>(null);
	const [fullName, setFullName] = useState("");
	const [ready, setReady] = useState(false);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		const supabase = getSupabase();
		supabase.auth
			.getSession()
			.then(async ({ data }) => {
				if (!data.session) {
					void navigate({ to: "/login" });
					return;
				}
				setSession(data.session);
				// maybeSingle returns null for a first login: no profiles row exists yet.
				const { data: profile, error: loadError } = await supabase
					.from("profiles")
					.select("full_name")
					.eq("id", data.session.user.id)
					.maybeSingle();
				if (loadError) {
					toast.error(t("app.loadError"));
				}
				const parsed = profileRowSchema.safeParse(profile);
				setFullName(parsed.success ? (parsed.data.full_name ?? "") : "");
				setReady(true);
			})
			.catch((error: unknown) => {
				// A failed session check must not trap the user on a blank page.
				console.error("Session check failed", error);
				void navigate({ to: "/login" });
			});
	}, [navigate, t]);

	async function onSave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!session) {
			return;
		}
		try {
			const result = await saveProfileFn({
				data: {
					accessToken: session.access_token,
					userId: session.user.id,
					fullName,
				},
			});
			if (!result.ok) {
				toast.error(t("app.saveError"));
				return;
			}
			setSaved(true);
		} catch (error) {
			// The server function can also fail on the network or on bad input.
			console.error("Profile save failed", error);
			toast.error(t("app.saveError"));
		}
	}

	async function onSignOut() {
		await getSupabase().auth.signOut();
		void navigate({ to: "/" });
	}

	if (!ready) {
		return (
			<div className="mx-auto max-w-md px-6 py-20">
				<Skeleton className="h-40 w-full" />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-md px-6 py-20">
			<Card>
				<CardHeader>
					<CardTitle>{t("app.profileTitle")}</CardTitle>
					<CardDescription>{session?.user.email}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSave} className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="profile-name">{t("app.fullName")}</Label>
							<Input
								id="profile-name"
								value={fullName}
								onChange={(event) => {
									setFullName(event.target.value);
									setSaved(false);
								}}
								placeholder={t("app.fullNamePlaceholder")}
							/>
						</div>
						{saved && (
							<p className="text-muted-foreground text-sm">
								{t("app.savedBody")}
							</p>
						)}
						<div className="flex items-center justify-between gap-2">
							<Button type="submit">{t("common.save")}</Button>
							<Button type="button" variant="outline" onClick={onSignOut}>
								{t("common.signOut")}
							</Button>
						</div>
					</form>
					<p className="mt-4 text-center">
						<Link to="/" className="text-muted-foreground text-sm underline">
							{t("common.appName")}
						</Link>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
