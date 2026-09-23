import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // functions/ (Cloud Functions) tiene su propio runner (`node:test`,
    // `cd functions && npm run test`) y su propio tsconfig — sin
    // relación con este proyecto Next.js. Sin excluirlo, vitest recoge
    // functions/src/**/*.test.ts (y functions/lib/**/*.test.js, el
    // artefacto compilado) y falla porque esos archivos usan la API de
    // node:test, no la de vitest.
    exclude: ["**/node_modules/**", "functions/**"],
  },
});
