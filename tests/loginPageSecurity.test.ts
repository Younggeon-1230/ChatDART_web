import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const LOGIN_PAGE_PATH = new URL("../src/app/login/page.tsx", import.meta.url);

test("login page keeps manual login and query email initialization without demo credential logic", async () => {
  const source = await readFile(LOGIN_PAGE_PATH, "utf8");

  assert.doesNotMatch(source, /DEMO_(?:EMAIL|PASSWORD|CREDENTIALS)/);
  assert.doesNotMatch(source, /handleDemoLogin/);
  assert.doesNotMatch(source, /데모 계정으로 로그인/);

  assert.match(source, /useState\(searchParams\.get\("email"\) \?\? ""\)/);
  assert.match(source, /<form[^>]+onSubmit=\{handleSubmit\}/);
  assert.match(source, /email: normalizedEmail/);
  assert.match(source, /password,/);
  assert.match(source, /router\.push\(redirectTo\)/);
  assert.match(source, /getAuthErrorMessage\(error, "login"\)/);
  assert.match(source, /disabled=\{isSubmitting\}/);
});
