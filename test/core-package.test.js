import test from "node:test";
import assert from "node:assert/strict";

test("core package exports default function", async () => {
  const core = await import("../index.js");

  assert.equal(typeof core.default, "function");
});
