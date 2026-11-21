// Writes of the Reports page: a new email schedule, a new rhythm of a schedule, and a new note.
// The schedule form, the schedules card, and the notes card call them. Each write lasts for this browser session.
// A later turn replaces each mutationFn with a Supabase insert or update. The onSuccess lines stay.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	addNote,
	addSchedule,
	setScheduleFrequency,
} from "../lib/sample-reports";
import type { Frequency, ScheduleInput } from "../lib/schedule-schema";
import { notesQueryOptions, schedulesQueryOptions } from "./reports.queries";

/** Adds a schedule from a parsed form, then reads the schedules again. */
export function useAddScheduleMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: ScheduleInput) => addSchedule(input),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: schedulesQueryOptions().queryKey,
			}),
	});
}

/** Sets the rhythm of one schedule, then reads the schedules again. */
export function useSetFrequencyMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (change: { id: string; frequency: Frequency }) =>
			setScheduleFrequency(change.id, change.frequency),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: schedulesQueryOptions().queryKey,
			}),
	});
}

/** Adds a note of the signed-in user, then reads the thread again. */
export function useAddNoteMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (text: string) => addNote(text),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: notesQueryOptions().queryKey }),
	});
}
