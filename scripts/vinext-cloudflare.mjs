import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
const forwardedArgs = process.argv.slice(3);
const entrypoints = {
  build: new URL("../node_modules/vite/bin/vite.js", import.meta.url),
  deploy: new URL(
    "../node_modules/@vinext/cloudflare/dist/cli.js",
    import.meta.url,
  ),
  dev: new URL("../node_modules/vite/bin/vite.js", import.meta.url),
};

if (!(command in entrypoints)) {
  console.error("Usage: vinext-cloudflare.mjs <dev|build|deploy> [...args]");
  process.exit(1);
}

const cliArgs = command === "deploy" ? ["deploy"] : [command];
const result = spawnSync(
  process.execPath,
  [fileURLToPath(entrypoints[command]), ...cliArgs, ...forwardedArgs],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_ORIGIN: "/",
      NEXT_PUBLIC_API_BASE_URL: "/",
      NEXT_PUBLIC_API_V1_BASE_URL: "/api/v1",
      NEXT_PUBLIC_USE_MOCK_API: "false",
      NEXT_PUBLIC_ENABLE_MOCK_FALLBACK: "false",
    },
  },
);

process.exit(result.status ?? 1);
