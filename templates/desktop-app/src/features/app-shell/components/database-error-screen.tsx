// The full-window screen of a database that did not open. DatabaseGate shows it in place of the app.
// The usual cause is migration_failed: a migration or a start check failed, and the shell kept the data as it was.
// The shell also shows a native dialog, and its update check still runs, so a fixed build reaches the user.
import { DbError } from "~/lib/db";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type DatabaseErrorScreenProps = {
	/** The error of the open check: a DbError of the shell or the preview, or an Error of the shell bridge. */
	error: Error;
};

/** The title, the promise that the data is unchanged, and the error text for support. */
export function DatabaseErrorScreen({ error }: DatabaseErrorScreenProps) {
	const { t } = useT();
	const code = error instanceof DbError ? error.code : error.name;

	return (
		<main
			role="alert"
			className="flex min-h-svh items-center justify-center bg-background p-6"
		>
			<Card className="w-full max-w-lg">
				<CardHeader>
					<CardTitle>{t("database.errorTitle")}</CardTitle>
					<CardDescription>{t("database.errorBody")}</CardDescription>
				</CardHeader>
				<CardContent>
					<details className="text-sm">
						<summary className="cursor-pointer text-muted-foreground">
							{t("database.errorDetails")}
						</summary>
						{/* The SQLite text is not translated. dir="auto" keeps it left to right in Arabic. */}
						<p
							dir="auto"
							className="mt-2 break-words font-mono text-muted-foreground text-xs"
						>
							{code}: {error.message}
						</p>
					</details>
				</CardContent>
			</Card>
		</main>
	);
}
