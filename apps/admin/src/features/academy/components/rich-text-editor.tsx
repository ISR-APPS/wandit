import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	Bold,
	Code2,
	Heading2,
	Heading3,
	ImageIcon,
	Italic,
	LinkIcon,
	List,
	ListOrdered,
	Minus,
	Pilcrow,
	Quote,
	Redo2,
	Strikethrough,
	Underline,
	Undo2,
	Unlink,
} from "lucide-react";
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
	disabled?: boolean;
	id?: string;
	value: string;
	onChange: (html: string) => void;
	placeholder?: string;
};

type ToolbarButtonProps = {
	label: string;
	active?: boolean;
	disabled?: boolean;
	onClick: () => void;
	children: ReactNode;
};

type ToolbarPopoverTriggerProps = {
	label: string;
	active?: boolean;
	disabled?: boolean;
	children: ReactNode;
};

function ToolbarButton({
	label,
	active,
	disabled,
	onClick,
	children,
}: ToolbarButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={label}
					aria-pressed={active}
					className={cn(active && "bg-accent text-accent-foreground")}
					disabled={disabled}
					onClick={onClick}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={6}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

function ToolbarPopoverTrigger({
	label,
	active,
	disabled,
	children,
}: ToolbarPopoverTriggerProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={label}
						aria-pressed={active}
						className={cn(active && "bg-accent text-accent-foreground")}
						disabled={disabled}
					>
						{children}
					</Button>
				</PopoverTrigger>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={6}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

function isWebUrl(value: string): boolean {
	try {
		const url = new URL(value);

		return (
			(url.protocol === "https:" || url.protocol === "http:") &&
			url.username === "" &&
			url.password === ""
		);
	} catch {
		return false;
	}
}

function isHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value);

		return (
			url.protocol === "https:" && url.username === "" && url.password === ""
		);
	} catch {
		return false;
	}
}

export function RichTextEditor({
	disabled = false,
	id: providedId,
	value,
	onChange,
	placeholder = "Write your guide...",
}: RichTextEditorProps) {
	const id = useId();
	const editorId = providedId ?? `${id}-editor`;
	const [linkOpen, setLinkOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");
	const [linkError, setLinkError] = useState<string | null>(null);
	const [imageOpen, setImageOpen] = useState(false);
	const [imageUrl, setImageUrl] = useState("");
	const [imageAlt, setImageAlt] = useState("");
	const [imageError, setImageError] = useState<string | null>(null);
	const extensions = useMemo(
		() => [
			StarterKit.configure({
				heading: { levels: [2, 3] },
				link: { autolink: true, openOnClick: false },
			}),
			Placeholder.configure({ placeholder }),
			Image.configure({ allowBase64: false, inline: true }),
		],
		[placeholder],
	);
	const editor = useEditor(
		{
			content: value,
			editorProps: {
				attributes: {
					"aria-label": "Guide body",
					"aria-multiline": "true",
					class: cn(
						"min-h-[320px] px-5 py-4 text-sm leading-7 outline-none",
						"[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
						"[&_blockquote]:my-5 [&_blockquote]:border-border [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
						"[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em]",
						"[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-semibold [&_h2]:text-2xl [&_h2]:tracking-tight",
						"[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-xl [&_h3]:tracking-tight",
						"[&_hr]:my-8 [&_hr]:border-border",
						"[&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg",
						"[&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3",
						"[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
						"[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm",
						"[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6",
					),
					id: editorId,
					role: "textbox",
					spellcheck: "true",
				},
			},
			extensions,
			immediatelyRender: false,
			onUpdate: ({ editor: updatedEditor }) => {
				onChange(updatedEditor.getHTML());
			},
			shouldRerenderOnTransaction: true,
		},
		[editorId, extensions],
	);
	const controlsDisabled = disabled || !editor;

	useEffect(() => {
		if (editor && editor.getHTML() !== value) {
			editor.commands.setContent(value, { emitUpdate: false });
		}
	}, [editor, value]);

	useEffect(() => {
		editor?.setEditable(!disabled);
	}, [disabled, editor]);

	function handleLinkOpenChange(open: boolean) {
		if (open && disabled) {
			return;
		}

		setLinkOpen(open);
		setLinkError(null);

		if (open) {
			const href = editor?.getAttributes("link").href;
			setLinkUrl(typeof href === "string" ? href : "");
		}
	}

	function applyLink() {
		if (disabled) {
			return;
		}

		const url = linkUrl.trim();

		if (!isWebUrl(url)) {
			setLinkError("Enter a valid HTTP or HTTPS URL.");
			return;
		}

		editor
			?.chain()
			.focus()
			.extendMarkRange("link")
			.setLink({ href: url })
			.run();
		setLinkError(null);
		setLinkOpen(false);
	}

	function removeLink() {
		if (disabled) {
			return;
		}

		editor?.chain().focus().extendMarkRange("link").unsetLink().run();
		setLinkError(null);
		setLinkOpen(false);
	}

	function handleImageOpenChange(open: boolean) {
		if (open && disabled) {
			return;
		}

		setImageOpen(open);
		setImageError(null);
	}

	function insertImage() {
		if (disabled) {
			return;
		}

		const url = imageUrl.trim();

		if (!isHttpsUrl(url)) {
			setImageError("Use a valid HTTPS image URL.");
			return;
		}

		editor
			?.chain()
			.focus()
			.setImage({ alt: imageAlt.trim() || undefined, src: url })
			.run();
		setImageUrl("");
		setImageAlt("");
		setImageError(null);
		setImageOpen(false);
	}

	function handlePopoverInputKeyDown(
		event: KeyboardEvent<HTMLInputElement>,
		action: () => void,
	) {
		if (event.key === "Enter") {
			event.preventDefault();
			action();
		}
	}

	return (
		<div
			aria-disabled={disabled}
			className={cn(
				"overflow-clip rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
				disabled && "opacity-70",
			)}
		>
			<TooltipProvider delayDuration={300}>
				<div
					role="toolbar"
					aria-label="Guide body formatting"
					className="sticky top-(--header-height) z-10 flex flex-wrap items-center gap-1 border-b bg-background/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
				>
					<fieldset
						className="m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
						aria-label="Text style"
					>
						<ToolbarButton
							label="Paragraph"
							active={editor?.isActive("paragraph")}
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().setParagraph().run()}
						>
							<Pilcrow />
						</ToolbarButton>
						<ToolbarButton
							label="Heading 2"
							active={editor?.isActive("heading", { level: 2 })}
							disabled={controlsDisabled}
							onClick={() =>
								editor?.chain().focus().toggleHeading({ level: 2 }).run()
							}
						>
							<Heading2 />
						</ToolbarButton>
						<ToolbarButton
							label="Heading 3"
							active={editor?.isActive("heading", { level: 3 })}
							disabled={controlsDisabled}
							onClick={() =>
								editor?.chain().focus().toggleHeading({ level: 3 }).run()
							}
						>
							<Heading3 />
						</ToolbarButton>
					</fieldset>

					<Separator orientation="vertical" className="mx-1 h-8" />

					<fieldset
						className="m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
						aria-label="Inline formatting"
					>
						<ToolbarButton
							label="Bold"
							active={editor?.isActive("bold")}
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().toggleBold().run()}
						>
							<Bold />
						</ToolbarButton>
						<ToolbarButton
							label="Italic"
							active={editor?.isActive("italic")}
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().toggleItalic().run()}
						>
							<Italic />
						</ToolbarButton>
						<ToolbarButton
							label="Strikethrough"
							active={editor?.isActive("strike")}
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().toggleStrike().run()}
						>
							<Strikethrough />
						</ToolbarButton>
						<ToolbarButton
							label="Underline"
							active={editor?.isActive("underline")}
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().toggleUnderline().run()}
						>
							<Underline />
						</ToolbarButton>
					</fieldset>

					<Separator orientation="vertical" className="mx-1 h-8" />

					<fieldset
						className="m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
						aria-label="Blocks"
					>
						<ToolbarButton
							label="Bullet list"
							active={editor?.isActive("bulletList")}
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().toggleBulletList().run()}
						>
							<List />
						</ToolbarButton>
						<ToolbarButton
							label="Ordered list"
							active={editor?.isActive("orderedList")}
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().toggleOrderedList().run()}
						>
							<ListOrdered />
						</ToolbarButton>
						<ToolbarButton
							label="Blockquote"
							active={editor?.isActive("blockquote")}
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().toggleBlockquote().run()}
						>
							<Quote />
						</ToolbarButton>
						<ToolbarButton
							label="Code block"
							active={editor?.isActive("codeBlock")}
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
						>
							<Code2 />
						</ToolbarButton>
						<ToolbarButton
							label="Horizontal rule"
							disabled={controlsDisabled}
							onClick={() => editor?.chain().focus().setHorizontalRule().run()}
						>
							<Minus />
						</ToolbarButton>
					</fieldset>

					<Separator orientation="vertical" className="mx-1 h-8" />

					<fieldset
						className="m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
						aria-label="Insert"
					>
						<Popover open={linkOpen} onOpenChange={handleLinkOpenChange}>
							<ToolbarPopoverTrigger
								label="Link"
								active={editor?.isActive("link")}
								disabled={controlsDisabled}
							>
								<LinkIcon />
							</ToolbarPopoverTrigger>
							<PopoverContent align="start" className="w-80 space-y-4">
								<div className="space-y-2">
									<Label htmlFor={`${id}-link-url`}>Link URL</Label>
									<Input
										id={`${id}-link-url`}
										type="url"
										placeholder="https://example.com"
										value={linkUrl}
										disabled={disabled}
										aria-invalid={linkError !== null}
										aria-describedby={
											linkError ? `${id}-link-error` : undefined
										}
										onChange={(event) => {
											setLinkUrl(event.target.value);
											setLinkError(null);
										}}
										onKeyDown={(event) =>
											handlePopoverInputKeyDown(event, applyLink)
										}
									/>
									{linkError ? (
										<p
											id={`${id}-link-error`}
											className="text-destructive text-xs"
										>
											{linkError}
										</p>
									) : null}
								</div>
								<div className="flex items-center justify-between gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={disabled || !editor?.isActive("link")}
										onClick={removeLink}
									>
										<Unlink />
										Remove
									</Button>
									<Button
										type="button"
										size="sm"
										disabled={disabled}
										onClick={applyLink}
									>
										Apply
									</Button>
								</div>
							</PopoverContent>
						</Popover>

						<Popover open={imageOpen} onOpenChange={handleImageOpenChange}>
							<ToolbarPopoverTrigger label="Image" disabled={controlsDisabled}>
								<ImageIcon />
							</ToolbarPopoverTrigger>
							<PopoverContent align="start" className="w-80 space-y-4">
								<div className="space-y-2">
									<Label htmlFor={`${id}-image-url`}>Image URL</Label>
									<Input
										id={`${id}-image-url`}
										type="url"
										placeholder="https://example.com/image.jpg"
										value={imageUrl}
										disabled={disabled}
										aria-invalid={imageError !== null}
										aria-describedby={
											imageError ? `${id}-image-error` : undefined
										}
										onChange={(event) => {
											setImageUrl(event.target.value);
											setImageError(null);
										}}
										onKeyDown={(event) =>
											handlePopoverInputKeyDown(event, insertImage)
										}
									/>
									{imageError ? (
										<p
											id={`${id}-image-error`}
											className="text-destructive text-xs"
										>
											{imageError}
										</p>
									) : null}
								</div>
								<div className="space-y-2">
									<Label htmlFor={`${id}-image-alt`}>Alt text (optional)</Label>
									<Input
										id={`${id}-image-alt`}
										placeholder="Describe the image"
										value={imageAlt}
										disabled={disabled}
										onChange={(event) => setImageAlt(event.target.value)}
										onKeyDown={(event) =>
											handlePopoverInputKeyDown(event, insertImage)
										}
									/>
								</div>
								<div className="flex justify-end">
									<Button
										type="button"
										size="sm"
										disabled={disabled}
										onClick={insertImage}
									>
										Insert image
									</Button>
								</div>
							</PopoverContent>
						</Popover>
					</fieldset>

					<Separator orientation="vertical" className="mx-1 h-8" />

					<fieldset
						className="m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
						aria-label="History"
					>
						<ToolbarButton
							label="Undo"
							disabled={
								controlsDisabled || !editor?.can().chain().focus().undo().run()
							}
							onClick={() => editor?.chain().focus().undo().run()}
						>
							<Undo2 />
						</ToolbarButton>
						<ToolbarButton
							label="Redo"
							disabled={
								controlsDisabled || !editor?.can().chain().focus().redo().run()
							}
							onClick={() => editor?.chain().focus().redo().run()}
						>
							<Redo2 />
						</ToolbarButton>
					</fieldset>
				</div>
			</TooltipProvider>

			<EditorContent editor={editor} className="min-h-[320px]" />
		</div>
	);
}
