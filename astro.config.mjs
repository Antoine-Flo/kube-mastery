import { defineConfig } from "astro/config";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import node from "@astrojs/node";

export default defineConfig({
    vite: {
        css: {
            transformer: "lightningcss",
        },
        build: {
            cssMinify: "lightningcss",
        },
        plugins: [
            paraglideVitePlugin({
                project: "./project.inlang",
                outdir: "./src/paraglide",
                strategy: ["url", "baseLocale"],
                urlPatterns: [
                    { pattern: "/", localized: [["en", "/"], ["fr", "/fr"]] },
                    {
                        pattern: "/:path(.*)?",
                        localized: [
                            ["fr", "/fr/:path(.*)?"],
                            ["en", "/:path(.*)?"],
                        ],
                    },
                ],
            }),
        ],
    },
    output: "server",
    adapter: node({
        mode: "standalone",
    }),
    prefetch: false
});