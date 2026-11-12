import { expect, it } from "vitest";
import getError from "../helpers/get-error.js";
import { stub } from "sinon";
import AggregateError from "aggregate-error";
import pipeline from "../../lib/plugins/pipeline.js";

it("Execute each function in series passing the same input", async (t) => {
  const step1 = stub().resolves(1);
  const step2 = stub().resolves(2);
  const step3 = stub().resolves(3);

  const result = await pipeline([step1, step2, step3])(0);
  expect(result).toEqual([1, 2, 3]);
  expect(step1.calledWith(0)).toBe(true);
  expect(step2.calledWith(0)).toBe(true);
  expect(step3.calledWith(0)).toBe(true);

  expect(step1.calledBefore(step2)).toBe(true);
  expect(step2.calledBefore(step3)).toBe(true);
});

it('Execute each function in series passing a transformed input from "getNextInput"', async (t) => {
  const step1 = stub().resolves(1);
  const step2 = stub().resolves(2);
  const step3 = stub().resolves(3);
  const step4 = stub().resolves(4);
  const getNextInput = (lastResult, result) => lastResult + result;

  const result = await pipeline([step1, step2, step3, step4], { settleAll: false, getNextInput })(0);

  expect(result).toEqual([1, 2, 3, 4]);
  expect(step1.calledWith(0)).toBe(true);
  expect(step2.calledWith(0 + 1)).toBe(true);
  expect(step3.calledWith(0 + 1 + 2)).toBe(true);
  expect(step4.calledWith(0 + 1 + 2 + 3)).toBe(true);
  expect(step1.calledBefore(step2)).toBe(true);
  expect(step2.calledBefore(step3)).toBe(true);
  expect(step3.calledBefore(step4)).toBe(true);
});

it('Execute each function in series passing the "lastResult" and "result" to "getNextInput"', async (t) => {
  const step1 = stub().resolves(1);
  const step2 = stub().resolves(2);
  const step3 = stub().resolves(3);
  const step4 = stub().resolves(4);
  const getNextInput = stub().returnsArg(0);

  const result = await pipeline([step1, step2, step3, step4], { settleAll: false, getNextInput })(5);

  expect(result).toEqual([1, 2, 3, 4]);
  expect(getNextInput.args).toEqual([
    [5, 1],
    [5, 2],
    [5, 3],
    [5, 4],
  ]);
});

it('Execute each function in series calling "transform" to modify the results', async (t) => {
  const step1 = stub().resolves(1);
  const step2 = stub().resolves(2);
  const step3 = stub().resolves(3);
  const step4 = stub().resolves(4);
  const getNextInput = stub().returnsArg(0);
  const transform = stub().callsFake((result) => result + 1);

  const result = await pipeline([step1, step2, step3, step4], { getNextInput, transform })(5);

  expect(result).toEqual([1 + 1, 2 + 1, 3 + 1, 4 + 1]);
  expect(getNextInput.args).toEqual([
    [5, 1 + 1],
    [5, 2 + 1],
    [5, 3 + 1],
    [5, 4 + 1],
  ]);
});

it('Execute each function in series calling "transform" to modify the results with "settleAll"', async (t) => {
  const step1 = stub().resolves(1);
  const step2 = stub().resolves(2);
  const step3 = stub().resolves(3);
  const step4 = stub().resolves(4);
  const getNextInput = stub().returnsArg(0);
  const transform = stub().callsFake((result) => result + 1);

  const result = await pipeline([step1, step2, step3, step4], { settleAll: true, getNextInput, transform })(5);

  expect(result).toEqual([1 + 1, 2 + 1, 3 + 1, 4 + 1]);
  expect(getNextInput.args).toEqual([
    [5, 1 + 1],
    [5, 2 + 1],
    [5, 3 + 1],
    [5, 4 + 1],
  ]);
});

it("Stop execution and throw error if a step rejects", async (t) => {
  const step1 = stub().resolves(1);
  const step2 = stub().rejects(new Error("test error"));
  const step3 = stub().resolves(3);

  const error = await getError(pipeline([step1, step2, step3])(0), {
    instanceOf: Error,
    message: "test error",
  });
  expect(error.message).toBe("test error");
  expect(step1.calledWith(0)).toBe(true);
  expect(step2.calledWith(0)).toBe(true);
  expect(step3.notCalled).toBe(true);
});

it("Throw all errors from the first step throwing an AggregateError", async (t) => {
  const error1 = new Error("test error 1");
  const error2 = new Error("test error 2");

  const step1 = stub().resolves(1);
  const step2 = stub().rejects(new AggregateError([error1, error2]));
  const step3 = stub().resolves(3);

  const error = await getError(pipeline([step1, step2, step3])(0));

  expect([...error.errors]).toEqual([error1, error2]);
  expect(step1.calledWith(0)).toBe(true);
  expect(step2.calledWith(0)).toBe(true);
  expect(step3.notCalled).toBe(true);
});

it("Execute all even if a Promise rejects", async (t) => {
  const error1 = new Error("test error 1");
  const error2 = new Error("test error 2");
  const step1 = stub().resolves(1);
  const step2 = stub().rejects(error1);
  const step3 = stub().rejects(error2);

  const error = await getError(pipeline([step1, step2, step3], { settleAll: true })(0));

  expect([...error.errors]).toEqual([error1, error2]);
  expect(step1.calledWith(0)).toBe(true);
  expect(step2.calledWith(0)).toBe(true);
  expect(step3.calledWith(0)).toBe(true);
});

it("Throw all errors from all steps throwing an AggregateError", async (t) => {
  const error1 = new Error("test error 1");
  const error2 = new Error("test error 2");
  const error3 = new Error("test error 3");
  const error4 = new Error("test error 4");
  const step1 = stub().rejects(new AggregateError([error1, error2]));
  const step2 = stub().rejects(new AggregateError([error3, error4]));

  const error = await getError(pipeline([step1, step2], { settleAll: true })(0));

  expect([...error.errors]).toEqual([error1, error2, error3, error4]);
  expect(step1.calledWith(0)).toBe(true);
  expect(step2.calledWith(0)).toBe(true);
});

it("Execute each function in series passing a transformed input even if a step rejects", async (t) => {
  const error2 = new Error("test error 2");
  const error3 = new Error("test error 3");
  const step1 = stub().resolves(1);
  const step2 = stub().rejects(error2);
  const step3 = stub().rejects(error3);
  const step4 = stub().resolves(4);
  const getNextInput = (previousResult, result) => previousResult + result;

  const error = await getError(pipeline([step1, step2, step3, step4], { settleAll: true, getNextInput })(0));

  expect([...error.errors]).toEqual([error2, error3]);
  expect(step1.calledWith(0)).toBe(true);
  expect(step2.calledWith(0 + 1)).toBe(true);
  expect(step3.calledWith(0 + 1 + error2)).toBe(true);
  expect(step4.calledWith(0 + 1 + error2 + error3)).toBe(true);
});
