import { Button } from "@wandit/ui/components/button";
import { Textarea } from "@wandit/ui/components/textarea";
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import { useTranslation } from "@/lib/i18n";
import type {
	PreviewSelection,
	PreviewSelectionRect,
} from "../../lib/preview-editor/messages";
import {
	sanitizeTargetCommentEntry,
	TARGET_COMMENT_MAX_LENGTH,
	type TargetCommentEntry,
} from "../../lib/use-target-comments";

type LayoutRect = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export type TargetCommentPopoverPosition = {
	insetInlineStart: number;
	top: number;
	placement: "above" | "below";
};

const POPOVER_GAP = 8;
const STAGE_PADDING = 8;
const FALLBACK_POPOVER_SIZE = { width: 320, height: 184 };

export function positionTargetCommentPopover({
	dir,
	selectionRect,
	iframeRect,
	stageRect,
	popoverSize,
}: {
	dir: "ltr" | "rtl";
	selectionRect: PreviewSelectionRect;
	iframeRect: LayoutRect;
	stageRect: LayoutRect;
	popoverSize: { width: number; height: number };
}): TargetCommentPopoverPosition {
	const anchorLeft = iframeRect.left - stageRect.left + selectionRect.left;
	const anchorTop = iframeRect.top - stageRect.top + selectionRect.top;
	const anchorWidth = selectionRect.width;
	const desiredLeft =
		dir === "rtl" ? anchorLeft + anchorWidth - popoverSize.width : anchorLeft;
	const maxLeft = Math.max(
		STAGE_PADDING,
		stageRect.width - popoverSize.width - STAGE_PADDING,
	);
	const physicalLeft = Math.min(Math.max(desiredLeft, STAGE_PADDING), maxLeft);
	const below = anchorTop + selectionRect.height + POPOVER_GAP;
	const above = anchorTop - popoverSize.height - POPOVER_GAP;
	const fitsBelow =
		below + popoverSize.height <= stageRect.height - STAGE_PADDING;
	const placement = fitsBelow || above < STAGE_PADDING ? "below" : "above";
	const desiredTop = placement === "below" ? below : above;
	const maxTop = Math.max(
		STAGE_PADDING,
		stageRect.height - popoverSize.height - STAGE_PADDING,
	);
	const top = Math.min(Math.max(desiredTop, STAGE_PADDING), maxTop);

	return {
		insetInlineStart:
			dir === "rtl"
				? stageRect.width - physicalLeft - popoverSize.width
				: physicalLeft,
		top,
		placement,
	};
}

export function TargetCommentPopover({
	selectionRect,
	queuedComment,
	queuedCount,
	queueFull,
	disabled,
	stageRef,
	iframeRef,
	registerFocus,
	onSend,
	onAdd,
	onUpdate,
	onRemove,
}: {
	selectionRect: PreviewSelectionRect;
	queuedComment: TargetCommentEntry | null;
	queuedCount: number;
	queueFull: boolean;
	disabled: boolean;
	stageRef: RefObject<HTMLDivElement | null>;
	iframeRef: RefObject<HTMLIFrameElement | null>;
	registerFocus: (focus: (() => void) | null) => void;
	onSend: (comment: string) => void;
	onAdd: (comment: string) => void;
	onUpdate: (comment: string) => void;
	onRemove: () => void;
}) {
	const { t, dir } = useTranslation();
	const [comment, setComment] = useState(queuedComment?.comment ?? "");
	const popoverRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [position, setPosition] = useState<TargetCommentPopoverPosition>({
		insetInlineStart: STAGE_PADDING,
		top: STAGE_PADDING,
		placement: "below",
	});

	useEffect(() => {
		registerFocus(() => textareaRef.current?.focus());
		return () => registerFocus(null);
	}, [registerFocus]);

	const updatePosition = useCallback(() => {
		const stage = stageRef.current;
		const iframe = iframeRef.current;
		if (!stage || !iframe) return;
		const stageRect = stage.getBoundingClientRect();
		const iframeRect = iframe.getBoundingClientRect();
		const measured = popoverRef.current?.getBoundingClientRect();
		const next = positionTargetCommentPopover({
			dir,
			selectionRect,
			iframeRect,
			stageRect,
			popoverSize: {
				width: measured?.width || FALLBACK_POPOVER_SIZE.width,
				height: measured?.height || FALLBACK_POPOVER_SIZE.height,
			},
		});
		setPosition((current) =>
			current.insetInlineStart === next.insetInlineStart &&
			current.top === next.top &&
			current.placement === next.placement
				? current
				: next,
		);
	}, [dir, iframeRef, selectionRect, stageRef]);

	useEffect(() => {
		updatePosition();
		const observer =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(updatePosition);
		if (stageRef.current) observer?.observe(stageRef.current);
		if (iframeRef.current) observer?.observe(iframeRef.current);
		if (popoverRef.current) observer?.observe(popoverRef.current);
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, {
			capture: true,
			passive: true,
		});
		return () => {
			observer?.disconnect();
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [iframeRef, stageRef, updatePosition]);

	const trimmed = comment.trim();
	const actionDisabled = disabled || trimmed.length === 0;
	const sendLabel =
		queuedCount > 0
			? t("workspace.page.editor.sendAll", { count: queuedCount + 1 })
			: t("workspace.page.editor.send");

	return (
		<div
			ref={popoverRef}
			role="dialog"
			aria-label={t("workspace.page.editor.commentAriaLabel")}
			data-placement={position.placement}
			data-logical-placement="inline-start"
			className="absolute z-30 w-80 max-w-[calc(100%_-_1rem)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl"
			style={{
				insetInlineStart: position.insetInlineStart,
				top: position.top,
			}}
		>
			<Textarea
				ref={textareaRef}
				dir="auto"
				value={comment}
				maxLength={TARGET_COMMENT_MAX_LENGTH}
				disabled={disabled}
				aria-label={t("workspace.page.editor.commentAriaLabel")}
				placeholder={t("workspace.page.editor.commentPlaceholder")}
				onChange={(event) => setComment(event.target.value)}
				className="min-h-20 resize-none text-sm"
			/>
			{queueFull && !queuedComment ? (
				<p className="mt-1.5 text-muted-foreground text-xs" role="status">
					{t("workspace.page.editor.queueFull")}
				</p>
			) : null}
			<div className="mt-2.5 flex items-center justify-end gap-2">
				{queuedComment ? (
					<>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={disabled}
							onClick={onRemove}
						>
							{t("workspace.page.editor.removeComment")}
						</Button>
						<Button
							type="button"
							size="sm"
							disabled={actionDisabled}
							onClick={() => onUpdate(trimmed)}
						>
							{t("workspace.page.editor.updateComment")}
						</Button>
					</>
				) : (
					<>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={actionDisabled || queueFull}
							onClick={() => onSend(trimmed)}
						>
							{sendLabel}
						</Button>
						<Button
							type="button"
							size="sm"
							disabled={actionDisabled || queueFull}
							onClick={() => onAdd(trimmed)}
						>
							{t("workspace.page.editor.addComment")}
						</Button>
					</>
				)}
			</div>
		</div>
	);
}

export function targetCommentEntry(
	selection: PreviewSelection,
	comment: string,
): TargetCommentEntry | null {
	return sanitizeTargetCommentEntry({
		wid: selection.wid,
		tag: selection.tag,
		excerpt: selection.excerpt,
		comment,
	});
}
