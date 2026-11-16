// The arched door of the method section: one reassuring line and the phone of the studio.
// MethodSection renders it under the arc on wide screens, and under the step list below that.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

/** The arched door panel. `className` places it: absolute in the arc, or centered in the flow. */
export function MethodDoor({ className }: { className?: string }) {
	const { t } = useT();
	return (
		<div
			className={cn(
				"louz-frame-arch w-full max-w-[330px] border-[1.7px] border-foreground/45 bg-background px-6 pt-[4.5rem] pb-6 text-center",
				className,
			)}
		>
			<p className="mb-2 font-display text-[1.25rem] leading-tight">
				{t("method.doorTitle")}
			</p>
			<p className="mb-4 text-[0.95rem] leading-normal">
				{t("method.doorBody")}
			</p>
			<a
				href={t("site.phoneHref")}
				className="louz-btn-ghost inline-flex min-h-12 items-center px-6 pt-[0.15em] font-bold"
			>
				{t("site.phoneDisplay")}
			</a>
		</div>
	);
}
