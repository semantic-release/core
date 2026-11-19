import { expect } from "vitest";

export default async function getError(promise, { instanceOf, message } = {}) {
  let error;

  try {
    await (typeof promise === "function" ? promise() : promise);
  } catch (caught) {
    error = caught;
  }

  expect(error, "Expected promise to reject").toBeDefined();
  if (instanceOf) expect(error).toBeInstanceOf(instanceOf);
  if (message instanceof RegExp) expect(error.message).toMatch(message);
  else if (message) expect(error.message).toContain(message);

  return error;
}
