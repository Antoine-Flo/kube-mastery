/**
 * Content collections config.
 * "courses" and "overview" are defined here so Astro does not auto-generate them
 * from src/content/courses/ and src/content/overview/ (those folders hold TS code, not markdown).
 * Both collections are empty (no .md in those paths).
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const courses = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/courses" }),
  schema: z.object({}),
});

const overview = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/overview" }),
  schema: z.object({}),
});

export const collections = { courses, overview };
