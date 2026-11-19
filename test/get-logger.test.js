import { expect, it } from "vitest";
import { spy } from "sinon";
import getLogger from "../lib/get-logger.js";

it('Expose "start", "skip", "complete", "error", "success", "warn" and "log" functions', (t) => {
  const stdout = spy();
  const stderr = spy();
  const logger = getLogger({ stdout: { write: stdout }, stderr: { write: stderr } });

  logger.start("test start");
  logger.skip("test skip");
  logger.complete("test complete");
  logger.log("test log");
  logger.success("test success");
  logger.error("test error");
  logger.warn("test warn");

  expect(stdout.args[0][0]).toMatch(/.*test start/);
  expect(stdout.args[1][0]).toMatch(/.*test skip/);
  expect(stdout.args[2][0]).toMatch(/.*test complete/);
  expect(stdout.args[3][0]).toMatch(/.*test log/);
  expect(stdout.args[4][0]).toMatch(/.*test success/);
  expect(stderr.args[0][0]).toMatch(/.*test error/);
  expect(stderr.args[1][0]).toMatch(/.*test warn/);
});
