/**
 * Sign-in panel of the More view: the user count and the sign-in methods.
 * Email and password is on and locked. Google, phone code, and magic link
 * show a "Soon" chip and do nothing. The count is `total` of the Cloud
 * users route (cloudAuthUsersQuery), read only while the backend is active.
 * Rendered by components/more/more-view.tsx inside PanelShell.
 */

import type { Icon } from "@phosphor-icons/react";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/EnvelopeSimple";
import { GoogleLogoIcon } from "@phosphor-icons/react/GoogleLogo";
import { InfoIcon } from "@phosphor-icons/react/Info";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@wandit/ui/components/switch";
import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

import { formatNumber, useTranslation } from "@/lib/i18n";
import {
	cloudAuthUsersQuery,
	cloudBackendQuery,
} from "../../api/cloud.queries";
import { PANEL_CARD_CLASS, PanelChip } from "./panel-shell";

export type SignInPanelProps = {
	projectId: string;
};

/** Methods the generated apps do not support yet, in display order, with their icon. Each id names its dictionary keys. */
const SOON_METHODS = [
	{ id: "google", icon: GoogleLogoIcon },
	{ id: "phoneOtp", icon: DeviceMobileIcon },
	{ id: "magicLink", icon: LinkSimpleIcon },
] as const satisfies readonly { id: string; icon: Icon }[];

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
			<section className={PANEL_CARD_CLASS}>
				<div className="flex items-center gap-2.5 px-5 py-4">
					<h2 className="font-grotesk font-semibold text-[15px] text-night dark:text-foreground">
						{t("appBuilder.signIn.methodsTitle")}
					</h2>
					{userCount === undefined ? null : (
						<PanelChip className="tabular-nums">
							{t("appBuilder.signIn.userCount", {
								count: userCount,
								countDisplay: formatNumber(userCount, locale),
							})}
						</PanelChip>
					)}
				</div>
				<MethodRow
					icon={EnvelopeSimpleIcon}
					isOn
					title={emailPasswordTitle}
					description={t("appBuilder.signIn.methods.emailPassword.description")}
				>
					{/* Every generated app signs users in with an email and a password, so this method cannot turn off. */}
					<Switch checked disabled aria-label={emailPasswordTitle} />
				</MethodRow>
				{SOON_METHODS.map((method) => (
					<MethodRow
						key={method.id}
						icon={method.icon}
						isOn={false}
						title={t(`appBuilder.signIn.methods.${method.id}.title`)}
						description={t(
							`appBuilder.signIn.methods.${method.id}.description`,
						)}
					>
						<PanelChip>{t("appBuilder.soon")}</PanelChip>
					</MethodRow>
				))}
			</section>
			<p className="flex items-center gap-2 px-1 font-sans text-[13px] text-night/60 dark:text-foreground/60">
				<InfoIcon
					aria-hidden
					weight="fill"
					className="size-4 shrink-0 text-ember-text"
				/>
				{t("appBuilder.signIn.signUpNote")}
			</p>
		</>
	);
}

/** One method row: its medallion, its title and note, and the switch or the chip at the end. */
function MethodRow({
	icon: MethodIcon,
	isOn,
	title,
	description,
	children,
}: {
	icon: Icon;
	/** True for the method the apps use today. A "Soon" method is muted. */
	isOn: boolean;
	title: string;
	description: string;
	/** The control at the end of the row. */
	children: ReactNode;
}) {
	return (
		<div className="flex items-center gap-3.5 border-night/[0.07] border-t px-5 py-3.5 dark:border-white/[0.07]">
			<span
				aria-hidden
				className={cn(
					"grid size-9 shrink-0 place-items-center rounded-full",
					isOn
						? "bg-spark/20 text-night dark:bg-spark/15 dark:text-spark"
						: "bg-night/[0.05] text-night/45 dark:bg-white/[0.06] dark:text-foreground/45",
				)}
			>
				<MethodIcon weight="duotone" className="size-[18px]" />
			</span>
			<div className={cn("min-w-0 flex-1", !isOn && "opacity-60")}>
				<p className="font-grotesk font-medium text-[14px] text-night dark:text-foreground">
					{title}
				</p>
				<p className="font-sans text-[13px] text-night/55 dark:text-foreground/55">
					{description}
				</p>
			</div>
			{children}
		</div>
	);
}
