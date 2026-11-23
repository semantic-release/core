import test from "ava";

test("core package exports default function", async (t) => {
  const core = await import("../index.js");

  t.is(typeof core.default, "function");
});
