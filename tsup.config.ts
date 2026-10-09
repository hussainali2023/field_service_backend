import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: ["es2022"],
  platform: "node",
  outDir: "dist",
  bundle: true,
  minify: true,
  banner: {
    js: `
   import { createRequire } from 'module';
   const require = createRequire(import.meta.url);
    `,
  },
});
