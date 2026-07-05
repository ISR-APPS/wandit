// TanStack Query mutations wrapping projects.services.ts: create-with-prompt
// (caller navigates to /p/$projectId), rename (updates list + detail caches),
// delete (optimistic removal from the grid with rollback).

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreateProjectBody, Project } from "./dto";
import { projectKeys } from "./projects.queries";
import {
	createProject,
	deleteProject,
	renameProject,
} from "./projects.services";

export function useCreateProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateProjectBody) => createProject(body),
		// Create returns ids only, so there is no full project to seed the detail
		// cache with — the workspace refetches it. Just refresh the grid.
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		},
	});
}

export function useRenameProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			renameProject(id, name),
		onSuccess: (project) => {
			queryClient.setQueryData(projectKeys.detail(project.id), project);
			queryClient.setQueryData<Project[]>(projectKeys.list(), (old) =>
				old?.map((p) => (p.id === project.id ? project : p)),
			);
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		},
	});
}

export function useDeleteProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteProject(id),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: projectKeys.lists() });
			const previous = queryClient.getQueryData<Project[]>(projectKeys.list());
			queryClient.setQueryData<Project[]>(projectKeys.list(), (old) =>
				old?.filter((p) => p.id !== id),
			);
			return { previous };
		},
		onError: (_error, _id, context) => {
			if (context?.previous) {
				queryClient.setQueryData(projectKeys.list(), context.previous);
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		},
	});
}
