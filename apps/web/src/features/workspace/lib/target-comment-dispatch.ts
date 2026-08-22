// Moved to the shared @wandit/preview-editor package (target-comments) so
// native composes the identical AI batch. Shim only.

export {
	buildTargetCommentMessage,
	dispatchTargetComments,
	type TargetCommentDispatchResult,
} from "@wandit/preview-editor/target-comments";
