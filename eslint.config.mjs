import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Fields excluded from a rest object are intentional omissions.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
  { ignores: [".playwright-cli/**", ".playwright-mcp/**", "reports/**"] },
];

export default eslintConfig;
