import { defineConfig } from "vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin-tanstack-start";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [netlify(), tanstackStart(), viteReact()],
});

export default config;
