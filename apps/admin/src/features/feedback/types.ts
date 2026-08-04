export type FeedbackType = "bug" | "idea" | "experience" | "praise";

export type FeedbackStatus = "new" | "reviewing" | "planned" | "resolved";

export type FeedbackPriority = "urgent" | "high" | "medium" | "low";

export type FeedbackReporter = {
	name: string;
	email: string;
	avatarUrl: string;
	plan: "Free" | "Starter" | "Pro" | "Business";
	memberSince: string;
};

export type FeedbackContext = {
	page: string;
	path: string;
	project: string;
	browser: string;
	device: string;
	viewport: string;
};

export type FeedbackAttachment = {
	name: string;
	type: "image" | "video";
	size: string;
};

export type FeedbackActivity = {
	id: string;
	label: string;
	description: string;
	createdAt: string;
	tone: "default" | "accent" | "success";
};

export type FeedbackItem = {
	id: string;
	title: string;
	message: string;
	type: FeedbackType;
	status: FeedbackStatus;
	priority: FeedbackPriority;
	createdAt: string;
	reporter: FeedbackReporter;
	context: FeedbackContext;
	tags: string[];
	attachment?: FeedbackAttachment;
	adminNote: string;
	activity: FeedbackActivity[];
};

export type FeedbackStatusFilter = "all" | FeedbackStatus;
export type FeedbackTypeFilter = "all" | FeedbackType;
export type FeedbackSort = "newest" | "oldest" | "priority";
