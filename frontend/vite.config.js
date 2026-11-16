import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
	root: new URL(".", import.meta.url).pathname,
	plugins: [react(), tailwind()],
	server: { proxy: { "/api": "http://127.0.0.1:5099" } },
	build: { outDir: "dist" },
});
