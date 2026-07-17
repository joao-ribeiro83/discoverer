import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "no-console": "warn",
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Playwright specs live outside the app's tsconfig project graph
    // (frontend/tsconfig.json only includes src/) and cross-file imports
    // between spec files confuse typescript-eslint's projectService into
    // resolving imported types as `error`/`any` even though `tsc --noEmit`
    // on the same files is clean — same class of issue the *.js override
    // above works around, just for a different reason.
    files: ["**/e2e/**/*.ts", "**/playwright.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  }
);
