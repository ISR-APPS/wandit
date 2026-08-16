import {
	type CreateStoryLinkInput,
	createStoryLinkInputSchema,
} from "@wandit/contracts";
import { Loader2Icon, LockKeyholeIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCreateStoryLinkMutation } from "@/features/story-links/api/story-links.mutations";
import {
	buildStoryLinkUrl,
	suggestStoryLinkSlug,
} from "@/features/story-links/lib/story-link-helpers";

const CUSTOM_VALUE = "__custom__";
const SOURCE_OPTIONS = ["instagram", "youtube", "tiktok", "newsletter"];
const MEDIUM_OPTIONS = ["story", "video", "post", "bio", "email"];

const fieldErrorMessages = {
	name: "Enter a name with 200 characters or fewer.",
	slug: "Use 2–64 lowercase letters, numbers, or dashes. Start with a letter or number.",
	utmSource: "Choose or enter a source with 200 characters or fewer.",
	utmMedium: "Choose or enter a medium with 200 characters or fewer.",
	utmCampaign: "Enter a campaign with 200 characters or fewer.",
	utmContent: "Content must be 500 characters or fewer.",
	destinationPath:
		"Start the destination with one slash, for example /pricing.",
} satisfies Record<keyof CreateStoryLinkInput, string>;

type FormFieldName = keyof typeof fieldErrorMessages;
type FormErrors = Partial<Record<FormFieldName, string>>;

type CreateStoryLinkDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function CreateStoryLinkDialog({
	open,
	onOpenChange,
}: CreateStoryLinkDialogProps) {
	const createMutation = useCreateStoryLinkMutation();
	const submittingRef = useRef(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const slugTouchedRef = useRef(false);
	const [sourceChoice, setSourceChoice] = useState("instagram");
	const [customSource, setCustomSource] = useState("");
	const [mediumChoice, setMediumChoice] = useState("story");
	const [customMedium, setCustomMedium] = useState("");
	const [campaign, setCampaign] = useState("");
	const campaignTouchedRef = useRef(false);
	const [content, setContent] = useState("");
	const [destinationPath, setDestinationPath] = useState("/");
	const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
	const [requestError, setRequestError] = useState<string | null>(null);
	const pending = createMutation.isPending;
	const source = sourceChoice === CUSTOM_VALUE ? customSource : sourceChoice;
	const medium = mediumChoice === CUSTOM_VALUE ? customMedium : mediumChoice;
	const shortUrl = buildStoryLinkUrl(slug || "your-slug");

	function clearFieldError(field: FormFieldName) {
		setRequestError(null);
		setFieldErrors((current) => {
			if (!current[field]) {
				return current;
			}

			const next = { ...current };
			delete next[field];
			return next;
		});
	}

	function handleNameChange(nextName: string) {
		setName(nextName);
		clearFieldError("name");

		if (slugTouchedRef.current) {
			return;
		}

		const nextSlug = suggestStoryLinkSlug(nextName);
		setSlug(nextSlug);
		clearFieldError("slug");
		if (!campaignTouchedRef.current) {
			setCampaign(nextSlug);
			clearFieldError("utmCampaign");
		}
	}

	function handleSlugChange(nextSlug: string) {
		const normalizedSlug = nextSlug.toLowerCase();
		setSlug(normalizedSlug);
		slugTouchedRef.current = true;
		clearFieldError("slug");
		if (!campaignTouchedRef.current) {
			setCampaign(normalizedSlug);
			clearFieldError("utmCampaign");
		}
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submittingRef.current) {
			return;
		}

		setRequestError(null);

		const candidate = {
			name: name.trim(),
			slug: slug.trim(),
			utmSource: source.trim(),
			utmMedium: medium.trim(),
			utmCampaign: campaign.trim(),
			...(content.trim() ? { utmContent: content.trim() } : {}),
			...(destinationPath.trim()
				? { destinationPath: destinationPath.trim() }
				: {}),
		};
		const parsed = createStoryLinkInputSchema.safeParse(candidate);

		if (!parsed.success) {
			const errors = getFormErrors(parsed.error.issues);
			setFieldErrors(errors);
			const firstInvalidField = Object.keys(errors)[0] as
				| FormFieldName
				| undefined;
			if (firstInvalidField) {
				focusInvalidField(event.currentTarget, firstInvalidField);
			}
			return;
		}

		setFieldErrors({});
		submittingRef.current = true;
		try {
			await createMutation.mutateAsync(parsed.data);
			toast.success(`${parsed.data.name} was created.`);
			onOpenChange(false);
		} catch (error) {
			setRequestError(
				error instanceof Error && error.message
					? error.message
					: "The story link could not be created.",
			);
		} finally {
			submittingRef.current = false;
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
				<form onSubmit={submit} noValidate className="space-y-5">
					<DialogHeader>
						<DialogTitle>Create story link</DialogTitle>
						<DialogDescription>
							Build a short link with campaign details for one story, video,
							post, or email.
						</DialogDescription>
					</DialogHeader>

					<ImmutableValuesNotice />

					<CreateLinkIdentityFields
						name={name}
						slug={slug}
						shortUrl={shortUrl}
						errors={fieldErrors}
						onNameChange={handleNameChange}
						onSlugChange={handleSlugChange}
					/>

					<CreateLinkAttributionFields
						sourceChoice={sourceChoice}
						customSource={customSource}
						mediumChoice={mediumChoice}
						customMedium={customMedium}
						errors={fieldErrors}
						onSourceChoiceChange={(value) => {
							setSourceChoice(value);
							clearFieldError("utmSource");
						}}
						onCustomSourceChange={(value) => {
							setCustomSource(value);
							clearFieldError("utmSource");
						}}
						onMediumChoiceChange={(value) => {
							setMediumChoice(value);
							clearFieldError("utmMedium");
						}}
						onCustomMediumChange={(value) => {
							setCustomMedium(value);
							clearFieldError("utmMedium");
						}}
					/>

					<CreateLinkTrackingFields
						campaign={campaign}
						content={content}
						destinationPath={destinationPath}
						errors={fieldErrors}
						onCampaignChange={(value) => {
							setCampaign(value);
							campaignTouchedRef.current = true;
							clearFieldError("utmCampaign");
						}}
						onContentChange={(value) => {
							setContent(value);
							clearFieldError("utmContent");
						}}
						onDestinationPathChange={(value) => {
							setDestinationPath(value);
							clearFieldError("destinationPath");
						}}
					/>

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
							disabled={pending}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={pending}>
							{pending ? <Loader2Icon className="animate-spin" /> : null}
							{pending ? "Creating…" : "Create link"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function ImmutableValuesNotice() {
	return (
		<div className="flex items-start gap-3 rounded-lg border bg-muted/25 p-3 text-sm">
			<LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<p className="text-muted-foreground leading-relaxed">
				Choose carefully. The slug and UTM values cannot change after you create
				the link. You can still rename or archive it later.
			</p>
		</div>
	);
}

type CreateLinkIdentityFieldsProps = {
	name: string;
	slug: string;
	shortUrl: string;
	errors: FormErrors;
	onNameChange: (value: string) => void;
	onSlugChange: (value: string) => void;
};

function CreateLinkIdentityFields({
	name,
	slug,
	shortUrl,
	errors,
	onNameChange,
	onSlugChange,
}: CreateLinkIdentityFieldsProps) {
	return (
		<>
			<FormField label="Name" htmlFor="story-link-name" error={errors.name}>
				<Input
					id="story-link-name"
					value={name}
					onChange={(event) => onNameChange(event.target.value)}
					placeholder="August product story"
					maxLength={200}
					required
					autoFocus
					aria-invalid={Boolean(errors.name)}
					aria-describedby={errorId("name", errors.name)}
				/>
			</FormField>

			<FormField
				label="Slug"
				htmlFor="story-link-slug"
				error={errors.slug}
				helper={
					<code className="block break-all font-mono text-[11px] text-foreground/75 tabular-nums">
						{shortUrl}
					</code>
				}
			>
				<Input
					id="story-link-slug"
					value={slug}
					onChange={(event) => onSlugChange(event.target.value)}
					placeholder="august-product-story"
					minLength={2}
					maxLength={64}
					pattern="[a-z0-9][a-z0-9-]{1,63}"
					required
					className="font-mono"
					aria-invalid={Boolean(errors.slug)}
					aria-describedby={describedBy("slug", errors.slug, true)}
				/>
			</FormField>
		</>
	);
}

type CreateLinkAttributionFieldsProps = {
	sourceChoice: string;
	customSource: string;
	mediumChoice: string;
	customMedium: string;
	errors: FormErrors;
	onSourceChoiceChange: (value: string) => void;
	onCustomSourceChange: (value: string) => void;
	onMediumChoiceChange: (value: string) => void;
	onCustomMediumChange: (value: string) => void;
};

function CreateLinkAttributionFields({
	sourceChoice,
	customSource,
	mediumChoice,
	customMedium,
	errors,
	onSourceChoiceChange,
	onCustomSourceChange,
	onMediumChoiceChange,
	onCustomMediumChange,
}: CreateLinkAttributionFieldsProps) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<PresetValueField
				id="story-link-source"
				label="Source"
				customLabel="Custom source"
				choice={sourceChoice}
				customValue={customSource}
				options={SOURCE_OPTIONS}
				error={errors.utmSource}
				onChoiceChange={onSourceChoiceChange}
				onCustomValueChange={onCustomSourceChange}
			/>
			<PresetValueField
				id="story-link-medium"
				label="Medium"
				customLabel="Custom medium"
				choice={mediumChoice}
				customValue={customMedium}
				options={MEDIUM_OPTIONS}
				error={errors.utmMedium}
				onChoiceChange={onMediumChoiceChange}
				onCustomValueChange={onCustomMediumChange}
			/>
		</div>
	);
}

type CreateLinkTrackingFieldsProps = {
	campaign: string;
	content: string;
	destinationPath: string;
	errors: FormErrors;
	onCampaignChange: (value: string) => void;
	onContentChange: (value: string) => void;
	onDestinationPathChange: (value: string) => void;
};

function CreateLinkTrackingFields({
	campaign,
	content,
	destinationPath,
	errors,
	onCampaignChange,
	onContentChange,
	onDestinationPathChange,
}: CreateLinkTrackingFieldsProps) {
	return (
		<>
			<FormField
				label="Campaign"
				htmlFor="story-link-campaign"
				error={errors.utmCampaign}
			>
				<Input
					id="story-link-campaign"
					value={campaign}
					onChange={(event) => onCampaignChange(event.target.value)}
					placeholder="august-product-story"
					maxLength={200}
					required
					aria-invalid={Boolean(errors.utmCampaign)}
					aria-describedby={errorId("campaign", errors.utmCampaign)}
				/>
			</FormField>

			<FormField
				label="Content"
				htmlFor="story-link-content"
				error={errors.utmContent}
				helper="Optional. Use this to distinguish different placements in the same campaign."
			>
				<Input
					id="story-link-content"
					value={content}
					onChange={(event) => onContentChange(event.target.value)}
					placeholder="opening-frame"
					maxLength={500}
					aria-invalid={Boolean(errors.utmContent)}
					aria-describedby={describedBy("content", errors.utmContent, true)}
				/>
			</FormField>

			<FormField
				label="Destination path"
				htmlFor="story-link-destination"
				error={errors.destinationPath}
				helper="Optional. Use / for the homepage or a path such as /pricing."
			>
				<Input
					id="story-link-destination"
					value={destinationPath}
					onChange={(event) => onDestinationPathChange(event.target.value)}
					placeholder="/"
					maxLength={2048}
					pattern="/[^/].*|/"
					aria-invalid={Boolean(errors.destinationPath)}
					aria-describedby={describedBy(
						"destination",
						errors.destinationPath,
						true,
					)}
				/>
			</FormField>
		</>
	);
}

type FormFieldProps = {
	label: string;
	htmlFor: string;
	error?: string;
	helper?: ReactNode;
	children: ReactNode;
};

function FormField({
	label,
	htmlFor,
	error,
	helper,
	children,
}: FormFieldProps) {
	const field = htmlFor.replace("story-link-", "");

	return (
		<div className="space-y-2">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
			{helper ? (
				<div
					id={`story-link-${field}-helper`}
					className="text-muted-foreground text-xs"
				>
					{helper}
				</div>
			) : null}
			{error ? (
				<p
					id={`story-link-${field}-error`}
					role="alert"
					className="text-destructive text-xs"
				>
					{error}
				</p>
			) : null}
		</div>
	);
}

type PresetValueFieldProps = {
	id: string;
	label: string;
	customLabel: string;
	choice: string;
	customValue: string;
	options: readonly string[];
	error?: string;
	onChoiceChange: (value: string) => void;
	onCustomValueChange: (value: string) => void;
};

function PresetValueField({
	id,
	label,
	customLabel,
	choice,
	customValue,
	options,
	error,
	onChoiceChange,
	onCustomValueChange,
}: PresetValueFieldProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Select value={choice} onValueChange={onChoiceChange} required>
				<SelectTrigger
					id={id}
					className="w-full"
					aria-invalid={Boolean(error)}
					aria-describedby={error ? `${id}-error` : undefined}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option} value={option}>
							{option}
						</SelectItem>
					))}
					<SelectItem value={CUSTOM_VALUE}>Other…</SelectItem>
				</SelectContent>
			</Select>
			{choice === CUSTOM_VALUE ? (
				<div className="space-y-2 pt-1">
					<Label htmlFor={`${id}-custom`} className="text-xs">
						{customLabel}
					</Label>
					<Input
						id={`${id}-custom`}
						value={customValue}
						onChange={(event) => onCustomValueChange(event.target.value)}
						placeholder={`Enter ${label.toLowerCase()}`}
						maxLength={200}
						required
						aria-invalid={Boolean(error)}
						aria-describedby={error ? `${id}-error` : undefined}
					/>
				</div>
			) : null}
			{error ? (
				<p id={`${id}-error`} role="alert" className="text-destructive text-xs">
					{error}
				</p>
			) : null}
		</div>
	);
}

function getFormErrors(
	issues: readonly { path: readonly PropertyKey[] }[],
): FormErrors {
	const errors: FormErrors = {};

	for (const issue of issues) {
		const field = issue.path[0];
		if (
			typeof field === "string" &&
			field in fieldErrorMessages &&
			!errors[field as FormFieldName]
		) {
			errors[field as FormFieldName] =
				fieldErrorMessages[field as FormFieldName];
		}
	}

	return errors;
}

function focusInvalidField(form: HTMLFormElement, field: FormFieldName) {
	const fieldIds = {
		name: "story-link-name",
		slug: "story-link-slug",
		utmSource: "story-link-source-custom",
		utmMedium: "story-link-medium-custom",
		utmCampaign: "story-link-campaign",
		utmContent: "story-link-content",
		destinationPath: "story-link-destination",
	} satisfies Record<FormFieldName, string>;
	const preferredField = form.querySelector<HTMLElement>(`#${fieldIds[field]}`);
	const fallbackField =
		field === "utmSource"
			? form.querySelector<HTMLElement>("#story-link-source")
			: field === "utmMedium"
				? form.querySelector<HTMLElement>("#story-link-medium")
				: null;

	(preferredField ?? fallbackField)?.focus();
}

function errorId(field: string, error?: string) {
	return error ? `story-link-${field}-error` : undefined;
}

function describedBy(
	field: string,
	error: string | undefined,
	helper: boolean,
) {
	return [
		helper ? `story-link-${field}-helper` : null,
		error ? `story-link-${field}-error` : null,
	]
		.filter(Boolean)
		.join(" ");
}

export type { CreateStoryLinkDialogProps };
export { CreateStoryLinkDialog };
