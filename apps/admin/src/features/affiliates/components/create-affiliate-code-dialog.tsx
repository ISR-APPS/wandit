import { Link2Icon, Loader2Icon, PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { useCreateAffiliateCodeMutation } from "@/features/affiliates/api/affiliates.mutations";

type CreateAffiliateCodeDialogProps = {
	affiliateId: string;
	affiliateName: string;
	defaultCommissionRatePercent: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const ATTRIBUTION_WINDOWS = [7, 14, 30, 60, 90] as const;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

function CreateAffiliateCodeDialog({
	affiliateId,
	affiliateName,
	defaultCommissionRatePercent,
	open,
	onOpenChange,
}: CreateAffiliateCodeDialogProps) {
	const [code, setCode] = useState("");
	const [label, setLabel] = useState("");
	const [landingPath, setLandingPath] = useState("/start");
	const [commissionRate, setCommissionRate] = useState(
		String(defaultCommissionRatePercent),
	);
	const [attributionWindow, setAttributionWindow] = useState("30");
	const [expiresAt, setExpiresAt] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [requestError, setRequestError] = useState<string | null>(null);
	const mutation = useCreateAffiliateCodeMutation();

	const cleanCode = code.trim().toUpperCase();
	const parsedCommission = Number(commissionRate);
	const codeIsValid = CODE_PATTERN.test(cleanCode);
	const labelIsValid = label.trim().length >= 2;
	const commissionIsValid =
		Number.isFinite(parsedCommission) &&
		parsedCommission > 0 &&
		parsedCommission <= 50;
	const landingPathIsValid = landingPath.trim().length > 0;

	function resetForm() {
		setCode("");
		setLabel("");
		setLandingPath("/start");
		setCommissionRate(String(defaultCommissionRatePercent));
		setAttributionWindow("30");
		setExpiresAt("");
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
			!codeIsValid ||
			!labelIsValid ||
			!commissionIsValid ||
			!landingPathIsValid
		) {
			return;
		}

		try {
			await mutation.mutateAsync({
				affiliateId,
				code: cleanCode,
				label: label.trim(),
				landingPath: landingPath.trim(),
				commissionRatePercent: parsedCommission,
				attributionWindowDays: Number(attributionWindow),
				expiresAt: expiresAt
					? new Date(`${expiresAt}T23:59:59.000Z`).toISOString()
					: null,
			});
			toast.success(`${cleanCode} was added to ${affiliateName}.`);
			resetForm();
			onOpenChange(false);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "The referral code could not be created.";
			setRequestError(message);
			toast.error(message);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<form onSubmit={handleSubmit} className="flex flex-col gap-6">
					<DialogHeader>
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
								<Link2Icon aria-hidden="true" />
							</div>
							<div className="min-w-0">
								<DialogTitle>Add referral code</DialogTitle>
								<DialogDescription className="mt-1 truncate">
									Create a trackable code for {affiliateName}.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<FieldGroup className="gap-5">
						<div className="grid gap-5 sm:grid-cols-2">
							<Field data-invalid={submitted && !codeIsValid}>
								<FieldLabel htmlFor="affiliate-code">Code</FieldLabel>
								<Input
									id="affiliate-code"
									value={code}
									onChange={(event) =>
										setCode(
											event.target.value.toUpperCase().replaceAll(" ", "-"),
										)
									}
									placeholder="CREATOR-20"
									className="font-mono uppercase"
									maxLength={32}
									aria-invalid={submitted && !codeIsValid}
									autoFocus
								/>
								<FieldError>
									{submitted && !codeIsValid
										? "Use 3–32 letters, numbers, dashes, or underscores."
										: null}
								</FieldError>
							</Field>

							<Field data-invalid={submitted && !labelIsValid}>
								<FieldLabel htmlFor="affiliate-code-label">Label</FieldLabel>
								<Input
									id="affiliate-code-label"
									value={label}
									onChange={(event) => setLabel(event.target.value)}
									placeholder="Newsletter launch"
									maxLength={80}
									aria-invalid={submitted && !labelIsValid}
								/>
								<FieldError>
									{submitted && !labelIsValid
										? "Add a short internal label."
										: null}
								</FieldError>
							</Field>
						</div>

						<Field data-invalid={submitted && !landingPathIsValid}>
							<FieldLabel htmlFor="affiliate-code-destination">
								Destination path
							</FieldLabel>
							<Input
								id="affiliate-code-destination"
								value={landingPath}
								onChange={(event) => setLandingPath(event.target.value)}
								placeholder="/start"
								aria-invalid={submitted && !landingPathIsValid}
							/>
							<FieldDescription>
								Preview: wandit.ai
								{landingPath.startsWith("/") ? landingPath : `/${landingPath}`}
								?ref={cleanCode || "YOUR-CODE"}
							</FieldDescription>
						</Field>

						<div className="grid gap-5 sm:grid-cols-3">
							<Field data-invalid={submitted && !commissionIsValid}>
								<FieldLabel htmlFor="affiliate-code-commission">
									Commission %
								</FieldLabel>
								<Input
									id="affiliate-code-commission"
									type="number"
									min={0.1}
									max={50}
									step={0.1}
									value={commissionRate}
									onChange={(event) => setCommissionRate(event.target.value)}
									aria-invalid={submitted && !commissionIsValid}
								/>
								<FieldError>
									{submitted && !commissionIsValid ? "Enter 0.1–50%." : null}
								</FieldError>
							</Field>

							<Field>
								<FieldLabel htmlFor="affiliate-code-window">
									Attribution
								</FieldLabel>
								<Select
									value={attributionWindow}
									onValueChange={setAttributionWindow}
								>
									<SelectTrigger id="affiliate-code-window" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{ATTRIBUTION_WINDOWS.map((days) => (
												<SelectItem key={days} value={String(days)}>
													{days} days
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</Field>

							<Field>
								<FieldLabel htmlFor="affiliate-code-expiry">Expires</FieldLabel>
								<Input
									id="affiliate-code-expiry"
									type="date"
									value={expiresAt}
									min={new Date().toISOString().slice(0, 10)}
									onChange={(event) => setExpiresAt(event.target.value)}
								/>
							</Field>
						</div>
					</FieldGroup>

					{requestError ? (
						<p
							role="alert"
							className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
						>
							{requestError}
						</p>
					) : null}

					<DialogFooter>
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
								<PlusIcon />
							)}
							{mutation.isPending ? "Creating…" : "Create code"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export type { CreateAffiliateCodeDialogProps };
export { CreateAffiliateCodeDialog };
