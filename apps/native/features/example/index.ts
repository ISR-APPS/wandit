/**
 * index.ts — the public surface (barrel) of the example feature.
 *
 * Everything a route or another feature might import is re-exported here — EXCEPT
 * screens. Screens are imported directly by their route file, so keeping them out
 * of the barrel stops them being pulled into random places and keeps the feature's
 * public API to "hooks, components, and data helpers".
 *
 * Import like:  import { useExamples, ExampleCard } from "@/features/example";
 */
export * from "@/features/example/api/example.keys";
export * from "@/features/example/api/example.mutations";
export * from "@/features/example/api/example.queries";
export * from "@/features/example/api/example.requests";
export * from "@/features/example/lib/example.constants";
export * from "@/features/example/lib/example.helpers";
export * from "@/features/example/lib/example.schemas";
export * from "@/features/example/lib/use-example-filters";
export { ExampleCard } from "@/features/example/components/example-card";
