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
    // D-012 — the dependency direction, enforced.
    //
    // `@discoverer-neo/core` (the `migrate/` workspace) is the only package
    // both other workspaces depend on, and the only thing keeping `dn-migrate`
    // runnable without a Fastify app is that it never reaches back into the
    // backend. Nothing but this rule stops one relative import from ending
    // that — `../../../backend/src/...` compiles fine.
    files: ["migrate/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/backend/**", "@discoverer-neo/backend", "@discoverer-neo/backend/*"],
              message:
                "@discoverer-neo/core must not import from backend/. Core is the shared, " +
                "dependency-free half; the edge points backend -> core, never the reverse.",
            },
          ],
        },
      ],
    },
  },
  {
    // The reciprocal rule. The backend may import core's shared schema
    // freely, but the *migration pipeline* is not request-path code: it opens
    // Oracle pools and writes the whole estate. Only the handful of modules
    // that legitimately drive it may reach for it.
    files: ["backend/src/**/*.ts"],
    ignores: [
      "backend/src/services/migration.service.ts",
      "backend/src/services/credential-file.service.ts",
      "backend/src/scripts/**/*.ts",
      "backend/src/**/__tests__/**/*.ts",
      "backend/src/**/*.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@discoverer-neo/core/migration",
              message:
                "The EUL migration pipeline is not request-path code. Drive it through " +
                "migration.service.ts; import @discoverer-neo/core/db/schema for the schema.",
            },
          ],
        },
      ],
    },
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
