import { defineConfig } from "astro/config";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import node from "@astrojs/node";

export default defineConfig({
    // ... other
    vite: {
        plugins: [
            paraglideVitePlugin({
                project: "./project.inlang",
                outdir: "./src/paraglide",
            }),
        ],
    },
    output: "server",
    adapter: node({ mode: "standalone" }),
});
