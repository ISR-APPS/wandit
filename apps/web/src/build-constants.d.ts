/**
 * Types of the build-time constants of the web app. `define` in
 * vite.config.ts and vitest.config.ts sets each value. Vite writes the
 * literal value into the code, so the bundler drops the dead branch.
 */

/**
 * False in the Vercel production build (wandit.dev), true in every other
 * build. False drops the V2 app-builder code from the bundle.
 */
declare const __V2_BUILDER_IN_BUILD__: boolean;
