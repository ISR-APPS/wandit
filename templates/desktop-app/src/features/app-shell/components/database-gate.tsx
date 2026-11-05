// Shows the app only after the database answers. RootLayout wraps the shell and the pages with it.
// A failed open shows DatabaseErrorScreen in place of the whole app, so no page reads a database that did not open.
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { CircleNotchIcon } from "~/shared/ui/icons";
import { databaseReadyQueryOptions } from "../api/database.queries";
import { DatabaseErrorScreen } from "./database-error-screen";

type DatabaseGateProps = {
	/** The app frame and its page. They render only after the open check passes. */
	children: ReactNode;
};

/** The open check: a short status while it runs, the error screen when it fails, else the app. */
export function DatabaseGate({ children }: DatabaseGateProps) {
	const { t } = useT();
	const ready = useQuery(databaseReadyQueryOptions());

	if (ready.isPending) {
		return (
			<div
				role="status"
				className="flex min-h-svh items-center justify-center gap-2 bg-background text-muted-foreground text-sm"
			>
				<CircleNotchIcon className="size-4 animate-spin" />
				{t("database.opening")}
			</div>
		);
	}
	if (ready.isError) {
		return <DatabaseErrorScreen error={ready.error} />;
	}
	return children;
}
