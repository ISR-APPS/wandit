/**
 * Sign-in panel of the More view: the user count and the sign-in methods.
 * Email and password is on and locked. Google, phone code, and magic link
 * show a "Soon" badge and do nothing. The count is `total` of the Cloud
 * users route (cloudAuthUsersQuery), read only while the backend is active.
 * Rendered by components/more/more-view.tsx inside PanelShell.
 */

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@wandit/ui/components/badge";
import { Switch } from "@wandit/ui/components/switch";
import { Info } from "lucide-react";

import { formatNumber, useTranslation } from "@/lib/i18n";
import {
	cloudAuthUsersQuery,
	cloudBackendQuery,
} from "../../api/cloud.queries";

export type SignInPanelProps = {
	projectId: string;
};

/** Methods the generated apps do not support yet, in display order. Each id names its dictionary keys. */
const SOON_METHODS = ["google", "phoneOtp", "magicLink"] as const;

/** One user row is enough: the answer carries the full `total`. */
const USER_COUNT_QUERY = { page: 1, pageSize: 1 } as const;

/** The method rows are fixed UI, not data. The count shows only once the API gave it. */
export function SignInPanel({ projectId }: SignInPanelProps) {
	const { t, locale } = useTranslation();
	// The page reads the same backend query, so this read hits the cache.
	const { data: backend } = useQuery(cloudBackendQuery(projectId, true));
	// The users route answers 409 until the backend is active, so the count waits for it.
	const users = useQuery(
		cloudAuthUsersQuery(
			projectId,
			USER_COUNT_QUERY,
			backend?.status === "active",
		),
	);
	// No backend, a backend that is not ready, or a failed read: the count is secondary, so it stays hidden.
	const userCount = users.data?.total;
	const emailPasswordTitle = t("appBuilder.signIn.methods.emailPassword.title");

	return (
		<>
			<section className="rounded-2xl border bg-card">
				<div className="flex items-baseline gap-2 px-4 py-3">
					<h2 className="font-semibold">
						{t("appBuilder.signIn.methodsTitle")}
					</h2>
					{userCount === undefined ? null : (
						<span className="text-muted-foreground text-xs">
							{t("appBuilder.signIn.userCount", {
								count: userCount,
								countDisplay: formatNumber(userCount, locale),
							})}
						</span>
					)}
				</div>
				<div className="flex items-center justify-between gap-4 border-t px-4 py-3">
					<div className="min-w-0">
						<p className="text-sm">{emailPasswordTitle}</p>
						<p className="text-muted-foreground text-xs">
							{t("appBuilder.signIn.methods.emailPassword.description")}
						</p>
					</div>
					{/* Every generated app signs users in with an email and a password, so this method cannot turn off. */}
					<Switch checked disabled aria-label={emailPasswordTitle} />
				</div>
				{SOON_METHODS.map((method) => (
					<div
						key={method}
						className="flex items-center justify-between gap-4 border-t px-4 py-3 opacity-60"
					>
						<div className="min-w-0">
							<p className="text-sm">
								{t(`appBuilder.signIn.methods.${method}.title`)}
							</p>
							<p className="text-muted-foreground text-xs">
								{t(`appBuilder.signIn.methods.${method}.description`)}
							</p>
						</div>
						<Badge variant="outline">{t("appBuilder.soon")}</Badge>
					</div>
				))}
			</section>
			<p className="flex items-center gap-2 text-muted-foreground text-xs">
				<Info className="size-3.5 shrink-0 text-primary" />
				{t("appBuilder.signIn.signUpNote")}
			</p>
		</>
	);
}
