/**
 * Example list screen at route "/profiles". It reads the `profiles` table
 * through the Supabase client and shows the loading, error, empty, and list
 * states. RLS returns only the row of the signed-in user.
 */
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList } from "react-native";
import { z } from "zod";
import { useT } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { AppButton, AppCard, AppSpinner, AppText, Screen } from "@/shared/ui";

// The client has no generated Database types; the rows are checked here.
const profileRowsSchema = z.array(
	z.object({ id: z.string(), full_name: z.string().nullable() }),
);

type ProfileRow = z.infer<typeof profileRowsSchema>[number];

/** What the list shows: a request in flight, a failed request, or the rows. */
type ListState =
	| { kind: "loading" }
	| { kind: "error" }
	| { kind: "ready"; rows: ProfileRow[] };

export default function ProfilesScreen() {
	const { t } = useT();
	const [state, setState] = useState<ListState>({ kind: "loading" });

	const load = useCallback(async () => {
		setState({ kind: "loading" });
		const { data, error } = await supabase
			.from("profiles")
			.select("id, full_name")
			.order("created_at");
		if (error) {
			// The database error text stays in the log; the screen shows a generic line.
			console.error("[profiles] load failed", error.message);
			setState({ kind: "error" });
			return;
		}
		const parsed = profileRowsSchema.safeParse(data);
		if (!parsed.success) {
			console.error("[profiles] unexpected row shape", parsed.error.message);
			setState({ kind: "error" });
			return;
		}
		setState({ kind: "ready", rows: parsed.data });
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	function goBack() {
		// A web visitor can open this route first; then no screen is behind it.
		if (router.canGoBack()) {
			router.back();
		} else {
			router.replace("/");
		}
	}

	return (
		<Screen>
			<AppButton
				className="self-start"
				onPress={goBack}
				size="sm"
				variant="ghost"
			>
				{t("common.back")}
			</AppButton>
			<AppText variant="title">{t("profiles.title")}</AppText>
			{state.kind === "loading" ? <AppSpinner /> : null}
			{state.kind === "error" ? (
				<>
					<AppText variant="caption">{t("profiles.loadError")}</AppText>
					<AppButton onPress={() => void load()} variant="secondary">
						{t("common.retry")}
					</AppButton>
				</>
			) : null}
			{state.kind === "ready" ? (
				<FlatList
					contentContainerClassName="gap-3"
					data={state.rows}
					keyExtractor={(row) => row.id}
					ListEmptyComponent={
						<AppText variant="caption">{t("profiles.empty")}</AppText>
					}
					renderItem={({ item }) => (
						<AppCard>
							<AppCard.Body>
								<AppCard.Title>
									{item.full_name ?? t("profiles.unnamed")}
								</AppCard.Title>
							</AppCard.Body>
						</AppCard>
					)}
				/>
			) : null}
		</Screen>
	);
}
