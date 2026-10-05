import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

function resolveTypeScriptFile(path) {
  const candidates = [path, `${path}.ts`, `${path}.tsx`];
  const resolved = candidates.find((candidate) => existsSync(candidate));

  return resolved ? pathToFileURL(resolved).href : null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolved = resolveTypeScriptFile(
      resolvePath(projectRoot, "src", specifier.slice(2))
    );

    if (resolved) return { url: resolved, shortCircuit: true };
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const parentPath = dirname(fileURLToPath(context.parentURL));
    const resolved = resolveTypeScriptFile(resolvePath(parentPath, specifier));

    if (resolved) return { url: resolved, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
