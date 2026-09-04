import assert from "node:assert/strict";
import test from "node:test";
import { Input } from "./input.ts";

test("touch controls queue an edge until the next snapshot", () => {
  const input = new Input();
  input.triggerSignalLeft();
  input.triggerGearReverse();
  input.triggerHeadlights();
  input.triggerHighBeam();
  input.triggerWiper();

  const first = input.snapshot();
  assert.equal(first.signalLeftEdge, true);
  assert.equal(first.gearReverseEdge, true);
  assert.equal(first.headlightsEdge, true);
  assert.equal(first.highBeamEdge, true);
  assert.equal(first.wiperEdge, true);

  const second = input.snapshot();
  assert.equal(second.signalLeftEdge, false);
  assert.equal(second.gearReverseEdge, false);
  assert.equal(second.headlightsEdge, false);
  assert.equal(second.highBeamEdge, false);
  assert.equal(second.wiperEdge, false);
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
