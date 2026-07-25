import { HandshakeIcon, Loader2Icon, UserRoundPlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type {
	Affiliate,
	AffiliateChannel,
	AffiliatePayoutMethod,
} from "@/features/affiliates/api/affiliates.dto";
import { useCreateAffiliateMutation } from "@/features/affiliates/api/affiliates.mutations";
import {
	AFFILIATE_CHANNEL_OPTIONS,
	AFFILIATE_PAYOUT_METHOD_OPTIONS,
} from "@/features/affiliates/lib/constants";

type CreateAffiliateSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated?: (affiliate: Affiliate) => void;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

function CreateAffiliateSheet({
	open,
	onOpenChange,
	onCreated,
}: CreateAffiliateSheetProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [company, setCompany] = useState("");
	const [country, setCountry] = useState("Algeria");
	const [channel, setChannel] = useState<AffiliateChannel>("creator");
	const [commissionRate, setCommissionRate] = useState("15");
	const [payoutMethod, setPayoutMethod] = useState<
		AffiliatePayoutMethod | "none"
	>("wise");
	const [payoutEmail, setPayoutEmail] = useState("");
	const [notes, setNotes] = useState("");
	const [includeCode, setIncludeCode] = useState(true);
	const [code, setCode] = useState("");
	const [codeLabel, setCodeLabel] = useState("Primary referral code");
	const [landingPath, setLandingPath] = useState("/start");
	const [submitted, setSubmitted] = useState(false);
	const [requestError, setRequestError] = useState<string | null>(null);
	const mutation = useCreateAffiliateMutation();

	const cleanEmail = email.trim();
	const cleanCode = code.trim().toUpperCase();
	const parsedCommission = Number(commissionRate);
	const nameIsValid = name.trim().length >= 2;
	const emailIsValid = EMAIL_PATTERN.test(cleanEmail);
	const countryIsValid = country.trim().length >= 2;
	const commissionIsValid =
		Number.isFinite(parsedCommission) &&
		parsedCommission > 0 &&
		parsedCommission <= 50;
	const payoutEmailIsValid =
		!payoutEmail.trim() || EMAIL_PATTERN.test(payoutEmail.trim());
	const codeIsValid =
		!includeCode ||
		(CODE_PATTERN.test(cleanCode) &&
			codeLabel.trim().length >= 2 &&
			landingPath.trim().length > 0);

	function resetForm() {
		setName("");
		setEmail("");
		setCompany("");
		setCountry("Algeria");
		setChannel("creator");
		setCommissionRate("15");
		setPayoutMethod("wise");
		setPayoutEmail("");
		setNotes("");
		setIncludeCode(true);
		setCode("");
		setCodeLabel("Primary referral code");
		setLandingPath("/start");
		setSubmitted(false);
		setRequestError(null);
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		if (!nextOpen) {
			resetForm();
		}
		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);
		setRequestError(null);

		if (
			!nameIsValid ||
			!emailIsValid ||
			!countryIsValid ||
			!commissionIsValid ||
			!payoutEmailIsValid ||
			!codeIsValid
		) {
			return;
		}

		try {
			const affiliate = await mutation.mutateAsync({
				name: name.trim(),
				email: cleanEmail,
				company: company.trim() || undefined,
				channel,
				country: country.trim(),
				defaultCommissionRatePercent: parsedCommission,
				payoutMethod: payoutMethod === "none" ? null : payoutMethod,
				payoutEmail: payoutEmail.trim() || undefined,
				notes: notes.trim() || undefined,
				initialCode: includeCode
					? {
							code: cleanCode,
							label: codeLabel.trim(),
							landingPath: landingPath.trim(),
							commissionRatePercent: parsedCommission,
							attributionWindowDays: 30,
						}
					: undefined,
			});
			toast.success(`${affiliate.name} was added as a pending affiliate.`);
			resetForm();
			onOpenChange(false);
			onCreated?.(affiliate);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "The affiliate could not be created.";
			setRequestError(message);
			toast.error(message);
		}
	}

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetContent className="w-full gap-0 sm:max-w-2xl">
				<form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
					<SheetHeader className="border-b px-5 py-5 pr-12 sm:px-6">
						<div className="flex items-start gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
								<UserRoundPlusIcon aria-hidden="true" />
							</div>
							<div>
								<SheetTitle>Create affiliate</SheetTitle>
								<SheetDescription className="mt-1">
									Add a partner, define their program terms, and issue the first
									trackable code.
								</SheetDescription>
							</div>
						</div>
					</SheetHeader>

					<div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
						<FieldGroup className="gap-8">
							<section className="space-y-4" aria-labelledby="identity-heading">
								<div>
									<h2 id="identity-heading" className="font-semibold text-sm">
										Partner identity
									</h2>
									<p className="mt-1 text-muted-foreground text-xs">
										Affiliate membership stays separate from the user&apos;s
										platform role.
									</p>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<Field data-invalid={submitted && !nameIsValid}>
										<FieldLabel htmlFor="new-affiliate-name">
											Full name
										</FieldLabel>
										<Input
											id="new-affiliate-name"
											value={name}
											onChange={(event) => setName(event.target.value)}
											placeholder="Nadia Benamar"
											maxLength={80}
											aria-invalid={submitted && !nameIsValid}
											autoFocus
										/>
										<FieldError>
											{submitted && !nameIsValid
												? "Enter the partner's name."
												: null}
										</FieldError>
									</Field>

									<Field data-invalid={submitted && !emailIsValid}>
										<FieldLabel htmlFor="new-affiliate-email">Email</FieldLabel>
										<Input
											id="new-affiliate-email"
											type="email"
											value={email}
											onChange={(event) => setEmail(event.target.value)}
											placeholder="nadia@studio.dz"
											aria-invalid={submitted && !emailIsValid}
										/>
										<FieldError>
											{submitted && !emailIsValid
												? "Enter a valid email address."
												: null}
										</FieldError>
									</Field>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<Field>
										<FieldLabel htmlFor="new-affiliate-company">
											Company
										</FieldLabel>
										<Input
											id="new-affiliate-company"
											value={company}
											onChange={(event) => setCompany(event.target.value)}
											placeholder="Optional"
											maxLength={100}
										/>
									</Field>
									<Field data-invalid={submitted && !countryIsValid}>
										<FieldLabel htmlFor="new-affiliate-country">
											Country
										</FieldLabel>
										<Input
											id="new-affiliate-country"
											value={country}
											onChange={(event) => setCountry(event.target.value)}
											aria-invalid={submitted && !countryIsValid}
										/>
										<FieldError>
											{submitted && !countryIsValid ? "Enter a country." : null}
										</FieldError>
									</Field>
								</div>
							</section>

							<section className="space-y-4" aria-labelledby="terms-heading">
								<div>
									<h2 id="terms-heading" className="font-semibold text-sm">
										Program terms
									</h2>
									<p className="mt-1 text-muted-foreground text-xs">
										New profiles stay pending until an administrator activates
										them.
									</p>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<Field>
										<FieldLabel htmlFor="new-affiliate-channel">
											Channel
										</FieldLabel>
										<Select
											value={channel}
											onValueChange={(value) =>
												setChannel(value as AffiliateChannel)
											}
										>
											<SelectTrigger
												id="new-affiliate-channel"
												className="w-full"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													{AFFILIATE_CHANNEL_OPTIONS.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
									</Field>

									<Field data-invalid={submitted && !commissionIsValid}>
										<FieldLabel htmlFor="new-affiliate-rate">
											Base commission
										</FieldLabel>
										<div className="relative">
											<Input
												id="new-affiliate-rate"
												type="number"
												min={0.1}
												max={50}
												step={0.1}
												value={commissionRate}
												onChange={(event) =>
													setCommissionRate(event.target.value)
												}
												className="pr-9"
												aria-invalid={submitted && !commissionIsValid}
											/>
											<span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground text-sm">
												%
											</span>
										</div>
										<FieldError>
											{submitted && !commissionIsValid
												? "Enter a rate from 0.1% to 50%."
												: null}
										</FieldError>
									</Field>
								</div>
							</section>

							<section className="space-y-4" aria-labelledby="payout-heading">
								<div>
									<h2 id="payout-heading" className="font-semibold text-sm">
										Payout details
									</h2>
									<p className="mt-1 text-muted-foreground text-xs">
										These mock details can be completed or changed later.
									</p>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<Field>
										<FieldLabel htmlFor="new-affiliate-payout">
											Method
										</FieldLabel>
										<Select
											value={payoutMethod}
											onValueChange={(value) =>
												setPayoutMethod(value as AffiliatePayoutMethod | "none")
											}
										>
											<SelectTrigger
												id="new-affiliate-payout"
												className="w-full"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													{AFFILIATE_PAYOUT_METHOD_OPTIONS.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
													<SelectItem value="none">Set later</SelectItem>
												</SelectGroup>
											</SelectContent>
										</Select>
									</Field>

									<Field data-invalid={submitted && !payoutEmailIsValid}>
										<FieldLabel htmlFor="new-affiliate-payout-email">
											Payout email
										</FieldLabel>
										<Input
											id="new-affiliate-payout-email"
											type="email"
											value={payoutEmail}
											onChange={(event) => setPayoutEmail(event.target.value)}
											placeholder="Optional"
											aria-invalid={submitted && !payoutEmailIsValid}
										/>
										<FieldError>
											{submitted && !payoutEmailIsValid
												? "Enter a valid payout email."
												: null}
										</FieldError>
									</Field>
								</div>
							</section>

							<section className="space-y-4" aria-labelledby="code-heading">
								<div className="flex items-start gap-3 rounded-lg border bg-muted/25 p-3">
									<Checkbox
										id="include-initial-code"
										checked={includeCode}
										onCheckedChange={(value) => setIncludeCode(Boolean(value))}
									/>
									<div className="min-w-0">
										<FieldLabel htmlFor="include-initial-code">
											Create an initial referral code
										</FieldLabel>
										<p className="mt-1 text-muted-foreground text-xs">
											The code stays paused until the partner is activated.
										</p>
									</div>
								</div>

								{includeCode ? (
									<div className="space-y-4 rounded-lg border p-4">
										<div className="grid gap-4 sm:grid-cols-2">
											<Field data-invalid={submitted && !codeIsValid}>
												<FieldLabel htmlFor="new-affiliate-code">
													Code
												</FieldLabel>
												<Input
													id="new-affiliate-code"
													value={code}
													onChange={(event) =>
														setCode(
															event.target.value
																.toUpperCase()
																.replaceAll(" ", "-"),
														)
													}
													placeholder="NADIA15"
													className="font-mono uppercase"
													maxLength={32}
													aria-invalid={submitted && !codeIsValid}
												/>
												<FieldError>
													{submitted && !codeIsValid
														? "Use 3–32 letters, numbers, dashes, or underscores."
														: null}
												</FieldError>
											</Field>
											<Field>
												<FieldLabel htmlFor="new-affiliate-code-label">
													Internal label
												</FieldLabel>
												<Input
													id="new-affiliate-code-label"
													value={codeLabel}
													onChange={(event) => setCodeLabel(event.target.value)}
													maxLength={80}
												/>
											</Field>
										</div>
										<Field>
											<FieldLabel htmlFor="new-affiliate-path">
												Destination
											</FieldLabel>
											<Input
												id="new-affiliate-path"
												value={landingPath}
												onChange={(event) => setLandingPath(event.target.value)}
												placeholder="/start"
											/>
											<FieldDescription>
												wandit.ai
												{landingPath.startsWith("/")
													? landingPath
													: `/${landingPath}`}
												?ref={cleanCode || "PARTNER-CODE"}
											</FieldDescription>
										</Field>
									</div>
								) : null}
							</section>

							<Field>
								<FieldLabel htmlFor="new-affiliate-notes">
									Internal notes
								</FieldLabel>
								<Textarea
									id="new-affiliate-notes"
									value={notes}
									onChange={(event) => setNotes(event.target.value)}
									placeholder="Audience, relationship owner, or special terms…"
									maxLength={300}
								/>
							</Field>
						</FieldGroup>

						{requestError ? (
							<p
								role="alert"
								className="mt-5 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
							>
								{requestError}
							</p>
						) : null}
					</div>

					<div className="flex flex-col-reverse gap-2 border-t bg-background px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
							disabled={mutation.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={mutation.isPending}>
							{mutation.isPending ? (
								<Loader2Icon className="animate-spin" />
							) : (
								<HandshakeIcon />
							)}
							{mutation.isPending ? "Creating…" : "Create affiliate"}
						</Button>
					</div>
				</form>
			</SheetContent>
		</Sheet>
	);
}

export type { CreateAffiliateSheetProps };
export { CreateAffiliateSheet };
