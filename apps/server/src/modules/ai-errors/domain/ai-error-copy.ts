/**
 * Renders safe English copy from a normalized AI error.
 * Server generation workflows call it before they store a failure.
 * It selects copy from the error kind and timeout message key.
 */
import type { NormalizedAiError } from "./normalized-ai-error";

const PROVIDER_FALLBACK = "The AI provider";
const PROVIDER_DEMAND_MESSAGE =
	"Our AI provider is experiencing high demand. Please try again in a few minutes.";

/** Keeps persisted server copy consistent with the localized chat copy. */
export function renderAiErrorSentence(normalized: NormalizedAiError): string {
	const provider = normalized.providerLabel ?? PROVIDER_FALLBACK;

	switch (normalized.kind) {
		case "internal":
			return "Something went wrong on our side. Please try again.";
		case "auth_config":
			return "The AI service is not available right now. Our team is notified.";
		case "invalid_request":
			return `${provider} did not accept this request. Try a shorter prompt or a different file.`;
		case "model_not_found":
			return "The AI model is not available right now. Our team is notified.";
		// Product rule (Zack, 2026-09-09): every transient provider failure shows the same demand copy in every locale.
		case "rate_limited":
		case "capacity":
		case "provider_error":
			return PROVIDER_DEMAND_MESSAGE;
		case "content_moderated":
			return normalized.moderationStage === "output"
				? `The content filter of ${provider} stopped this generation. Change the prompt and try again.`
				: `${provider} declined this request because of its content rules. Change the prompt and try again.`;
		case "timeout":
			if (normalized.userMessage.key === "errors.ai.timeout_budget") {
				return "This took longer than we allow, so we stopped it. Please try again.";
			}
			if (normalized.userMessage.key === "errors.ai.timeout_connector") {
				return `${provider} accepted the job but did not report a result in time. Check ${provider} before you try again.`;
			}
			// Product rule: ordinary provider timeouts use the same demand copy as other transient failures.
			return PROVIDER_DEMAND_MESSAGE;
		case "network":
			return `We cannot reach ${provider}. Please try again.`;
		case "cancelled":
			return "This generation was stopped.";
		case "billing":
			return normalized.statusCode === 403
				? "You have reached your monthly credit limit in this workspace. Ask a workspace owner to raise it."
				: "Not enough credits for this action.";
		case "connector_unreachable":
			return `${provider} is not reachable. Check the connection in Settings and try again.`;
		case "connector_account":
			return normalized.providerMessage
				? `${normalized.providerMessage} Update your ${provider} account, then try again.`
				: `Update your ${provider} account, then try again.`;
		case "connector_rejected":
			return normalized.providerMessage
				? `${provider} returned: ${normalized.providerMessage}`
				: `${provider} failed without giving a reason.`;
		case "unknown":
			return "Something went wrong. Please try again.";
	}
}
