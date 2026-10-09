// Lint gate for React hooks and lifecycle mistakes (runs with `npm run lint`, together with the type check).
// rules-of-hooks is an error: a hook called conditionally crashes the page the next time the condition flips.
// exhaustive-deps is an error too: where a dependency list is deliberately short, the line above it must say why.
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "public/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/set-state-in-render": "error",
      "react-hooks/static-components": "error",
      "@next/next/no-img-element": "off",
    },
  },
);
