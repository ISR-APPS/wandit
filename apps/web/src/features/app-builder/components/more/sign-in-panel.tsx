/**
 * Sign-in panel: the user count and one switch per sign-in method.
 * Reads signInSummaryQuery and writes a switch change through
 * useSetSignInMethod, which updates the query cache on success.
 * Rendered by components/more/more-view.tsx inside PanelShell.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { Switch } from "@wandit/ui/components/switch";
import { Info } from "lucide-react";

import { formatNumber, type TranslationKey, useTranslation } from "@/lib/i18n";
import { useSetSignInMethod } from "../../api/app-builder.mutations";
import { signInSummaryQuery } from "../../api/app-builder.queries";
import type { SignInMethodId } from "../../api/dto";

export type SignInPanelProps = {
	projectId: string;
};

/** Title and hint keys of each method. The ids come from the summary, the copy from the dictionary. */
const METHOD_COPY: Record<
	SignInMethodId,
	{ title: TranslationKey; description: TranslationKey }
> = {
	phoneOtp: {
		title: "appBuilder.signIn.methods.phoneOtp.title",
		description: "appBuilder.signIn.methods.phoneOtp.description",
	},
	emailPassword: {
		title: "appBuilder.signIn.methods.emailPassword.title",
		description: "appBuilder.signIn.methods.emailPassword.description",
	},
	google: {
		title: "appBuilder.signIn.methods.google.title",
		description: "appBuilder.signIn.methods.google.description",
	},
	magicLink: {
		title: "appBuilder.signIn.methods.magicLink.title",
		description: "appBuilder.signIn.methods.magicLink.description",
	},
};

export function SignInPanel({ projectId }: SignInPanelProps) {
	const { t, locale } = useTranslation();
	const { data } = useSuspenseQuery(signInSummaryQuery(projectId));
	const setMethod = useSetSignInMethod(projectId);

	return (
		<>
			<section className="rounded-2xl border bg-card">
				<div className="flex items-baseline gap-2 px-4 py-3">
					<h2 className="font-semibold">
						{t("appBuilder.signIn.methodsTitle")}
					</h2>
					<span className="text-muted-foreground text-xs">
						{t("appBuilder.signIn.userCount", {
							count: data.userCount,
							countDisplay: formatNumber(data.userCount, locale),
						})}
					</span>
				</div>
				{data.methods.map((method) => {
					const title = t(METHOD_COPY[method.id].title);
					return (
						<div
							key={method.id}
							className="flex items-center justify-between gap-4 border-t px-4 py-3"
						>
							<div className="min-w-0">
								<p className="text-sm">{title}</p>
								<p className="text-muted-foreground text-xs">
									{t(METHOD_COPY[method.id].description)}
								</p>
							</div>
							<Switch
								checked={method.enabled}
								aria-label={title}
								// One change at a time, so a second click cannot race the first write.
								disabled={setMethod.isPending}
								onCheckedChange={(enabled) =>
									setMethod.mutate({ methodId: method.id, enabled })
								}
							/>
						</div>
					);
				})}
			</section>
			<p className="flex items-center gap-2 text-muted-foreground text-xs">
				<Info className="size-3.5 shrink-0 text-primary" />
				{t("appBuilder.signIn.otpNote")}
			</p>
		</>
	);
}
