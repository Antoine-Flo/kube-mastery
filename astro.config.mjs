import { defineConfig } from "astro/config";

export default defineConfig({
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