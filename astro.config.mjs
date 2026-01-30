import { defineConfig } from "astro/config";
import mermaid from "astro-mermaid";

export default defineConfig({
    integrations: [
        mermaid({
            theme: 'forest',
            autoTheme: true
        })
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