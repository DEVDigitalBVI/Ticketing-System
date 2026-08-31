import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import typeScriptEslint from "typescript-eslint";

export default defineConfig([
  ...typeScriptEslint.configs.recommended,
  {
    ...nextPlugin.configs["core-web-vitals"],
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
  },
  globalIgnores([".next/**", "coverage/**", "design-prototype 2/**", "next-env.d.ts"]),
]);
