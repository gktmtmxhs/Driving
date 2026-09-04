import assert from "node:assert/strict";
import test from "node:test";
import { Input } from "./input.ts";

test("touch controls queue an edge until the next snapshot", () => {
  const input = new Input();
  input.triggerSignalLeft();
  input.triggerGearReverse();

  const first = input.snapshot();
  assert.equal(first.signalLeftEdge, true);
  assert.equal(first.gearReverseEdge, true);

  const second = input.snapshot();
  assert.equal(second.signalLeftEdge, false);
  assert.equal(second.gearReverseEdge, false);
});

test("resetTouch releases held pedals and queued actions", () => {
  const input = new Input();
  input.throttleTouch = 1;
  input.brakeTouch = 1;
  input.steerTouch = 0.8;
  input.triggerSignalRight();
  input.resetTouch();

  const snapshot = input.snapshot();
  assert.equal(snapshot.throttle, 0);
  assert.equal(snapshot.brake, 0);
  assert.equal(snapshot.steer, 0);
  assert.equal(snapshot.signalRightEdge, false);
});
