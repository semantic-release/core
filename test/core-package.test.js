import { expect, it } from "vitest";

it("core package exports default function", async () => {
  const core = await import("../index.js");

  expect(typeof core.default).toBe("function");
});
