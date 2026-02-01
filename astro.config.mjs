import { defineConfig } from "astro/config";
import mermaid from "astro-mermaid";
import sitemap from "@astrojs/sitemap";
import remarkCalloutColons from "./src/plugins/remark-callout-colons.js";

export default defineConfig({
    markdown: {
        remarkPlugins: [remarkCalloutColons],
    },
    integrations: [
        mermaid({
            theme: 'forest',
            autoTheme: true
        }),
        sitemap()
    ],
    vite: {
        css: {
            transformer: "lightningcss",
        },
        build: {
            cssMinify: "lightningcss",
        },
    },
    output: "static",
    redirects: {
        "/": "/en",
        "/terms-of-service": "/en/terms-of-service",
        "/privacy-policy": "/en/privacy-policy",
        "/courses": "/en/courses",
    },
});