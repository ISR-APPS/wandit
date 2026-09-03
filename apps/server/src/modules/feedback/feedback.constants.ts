// Label applied to every issue this feature creates. The Linear team uses it
// to separate in-app feedback from engineering-filed issues.
export const FEEDBACK_LABEL_NAME = "User feedback issues";

// Color of the label when this code has to create it.
export const FEEDBACK_LABEL_COLOR = "#4EA7FC";

// One user can post 5 times in 10 minutes.
export const FEEDBACK_RATE_LIMIT = {
	limit: 5,
	windowMs: 10 * 60_000,
} as const;

// A Sentry error this old or newer is related to the feedback.
export const SENTRY_RECENT_ERROR_MS = 2 * 60_000;
