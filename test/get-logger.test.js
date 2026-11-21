import test from "ava";
import { spy } from "sinon";
import getLogger from "../lib/get-logger.js";

test('Expose "start", "skip", "complete", "error", "success", "warn" and "log" functions', (t) => {
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

  t.regex(stdout.args[0][0], /.*test start/);
  t.regex(stdout.args[1][0], /.*test skip/);
  t.regex(stdout.args[2][0], /.*test complete/);
  t.regex(stdout.args[3][0], /.*test log/);
  t.regex(stdout.args[4][0], /.*test success/);
  t.regex(stderr.args[0][0], /.*test error/);
  t.regex(stderr.args[1][0], /.*test warn/);
});
