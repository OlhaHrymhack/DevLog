import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const SLICE_ENTRY = "index.{ts,tsx}";

const sliceLayers = (...types) => {
  return { to: { element: { type: types, fileInternalPath: SLICE_ENTRY } } };
};

const TO_SHARED = { to: { element: { type: "shared" } } };

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    ".factory/**",
    ".claude/**",
    ".githooks/**",
    "docs/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "eslint-fixtures/**",
  ]),
  {
    // Стрілкові const у всьому коді застосунку: src, test, e2e і кореневі конфіги (не `.factory`, `.claude`, `docs` — вони в globalIgnores).
    files: ["**/*.{ts,tsx,mts,mjs}"],
    rules: {
      "func-style": ["error", "expression", { allowArrowFunctions: true }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { project: "./tsconfig.json" } },
      "boundaries/elements": [
        { type: "api", pattern: "src/app/api" },
        { type: "app", pattern: "src/app" },
        { type: "views", pattern: "src/views/*", capture: ["slice"] },
        { type: "widgets", pattern: "src/widgets/*", capture: ["slice"] },
        { type: "features", pattern: "src/features/*", capture: ["slice"] },
        { type: "entities", pattern: "src/entities/*", capture: ["slice"] },
        { type: "shared", pattern: "src/shared/*", capture: ["segment"] },
        { type: "server", pattern: "src/server" },
      ],
      "boundaries/files": [{ category: "instrumentation", pattern: "src/instrumentation.ts" }],
      "boundaries/elements-single-match": true,
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Use named exports; export default is allowed only in Next.js files under src/app.",
        },
        {
          selector: "ExportNamedDeclaration > ExportSpecifier[exported.name='default']",
          message: "Use named exports; export default is allowed only in Next.js files under src/app.",
        },
      ],
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: [sliceLayers("views", "widgets", "features", "entities"), TO_SHARED],
            },
            {
              from: { file: { categories: "instrumentation" } },
              allow: [TO_SHARED],
            },
            {
              from: { element: { type: "api" } },
              allow: [
                { to: { element: { type: "server" } } },
                sliceLayers("entities"),
                TO_SHARED,
              ],
            },
            {
              from: { element: { type: "views" } },
              allow: [sliceLayers("widgets", "features", "entities"), TO_SHARED],
            },
            {
              from: { element: { type: "widgets" } },
              allow: [sliceLayers("features", "entities"), TO_SHARED],
            },
            {
              from: { element: { type: "features" } },
              allow: [sliceLayers("entities"), TO_SHARED],
            },
            {
              from: { element: { type: "entities" } },
              allow: [TO_SHARED],
            },
            {
              from: { element: { type: "shared" } },
              allow: [TO_SHARED],
            },
            {
              from: { element: { type: "server" } },
              allow: [sliceLayers("entities"), TO_SHARED],
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/shared/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Згенерований shadcn (`shared/ui/<Name>/index.tsx`) містить `as` (напр. CSSProperties); власні Button, EmptyState, ResponsiveDialog — без винятків.
    files: [
      "src/shared/ui/{Alert,Badge,Card,Checkbox,Dialog,Input,Progress,Select,Sheet,Skeleton,Sonner,Switch,Tabs,Textarea,Toggle,ToggleGroup,Tooltip}/index.tsx",
    ],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
    },
  },
]);

export default eslintConfig;
