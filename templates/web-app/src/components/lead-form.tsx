// COD lead form. The field names and the honeypot are the wandit contract.
// Submit validates locally and dispatches `wandit:lead`; no network request.
// The preview has no listener, so the dispatch is a safe no-op there.
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
import { submitLead } from "~/lib/wandit-leads";

type SubmitState = "idle" | "success" | "error";

export function LeadForm() {
	const { t } = useT();
	const [state, setState] = useState<SubmitState>("idle");

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const entries = Object.fromEntries(
			new FormData(event.currentTarget).entries(),
		);
		const result = submitLead(entries);
		// A honeypot hit returns ok:true so bots see the same success state.
		setState(result.ok ? "success" : "error");
	}

	if (state === "success") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("lead.successTitle")}</CardTitle>
					<CardDescription>{t("lead.successBody")}</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("lead.title")}</CardTitle>
				<CardDescription>{t("lead.subtitle")}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit} className="grid gap-4" noValidate>
					<div className="grid gap-2">
						<Label htmlFor="lead-name">{t("lead.name")}</Label>
						<Input
							id="lead-name"
							name="name"
							required
							autoComplete="name"
							placeholder={t("lead.namePlaceholder")}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="lead-phone">{t("lead.phone")}</Label>
						<Input
							id="lead-phone"
							name="phone"
							type="tel"
							required
							autoComplete="tel"
							placeholder={t("lead.phonePlaceholder")}
						/>
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="lead-wilaya">{t("lead.wilaya")}</Label>
							<Input
								id="lead-wilaya"
								name="wilaya"
								required
								placeholder={t("lead.wilayaPlaceholder")}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="lead-commune">{t("lead.commune")}</Label>
							<Input
								id="lead-commune"
								name="commune"
								required
								placeholder={t("lead.communePlaceholder")}
							/>
						</div>
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="lead-product">{t("lead.product")}</Label>
							<Input
								id="lead-product"
								name="product"
								required
								placeholder={t("lead.productPlaceholder")}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="lead-quantity">{t("lead.quantity")}</Label>
							<Input
								id="lead-quantity"
								name="quantity"
								type="number"
								min={1}
								required
								defaultValue={1}
							/>
						</div>
					</div>
					{/* The honeypot must stay exactly like this: name, attribute, a11y flags. */}
					<div
						className="absolute -start-[9999px] opacity-0"
						aria-hidden="true"
					>
						<input
							type="text"
							name="website"
							data-wandit-hp
							tabIndex={-1}
							autoComplete="off"
							aria-hidden="true"
						/>
					</div>
					{state === "error" && (
						<p className="text-destructive text-sm" role="alert">
							{t("lead.errorRequired")}
						</p>
					)}
					<Button type="submit" className="w-full">
						{t("lead.submit")}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
