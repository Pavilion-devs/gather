import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO,
  PROPOSED,
  evaluatePlan,
  acceptRevision,
  time,
  minutes,
} from "../shared/plan.mjs";
test("conflicts include setup dependency and next-day removal", () => {
  const c = evaluatePlan(DEMO);
  assert.equal(c.ready, 780);
  assert.equal(c.removed, 1440);
  assert.equal(c.cateringLate, 60);
  assert.equal(c.removalLate, 60);
  assert.equal(c.timing, 2);
  assert.equal(time(c.removed), "00:00 next day");
});
test("reviewed reply changes only dependent times; preserves price unknown and florist approval", () => {
  const p = acceptRevision(DEMO, 2);
  const c = evaluatePlan(p);
  assert.equal(c.ready, 690);
  assert.equal(c.removed, 1365);
  assert.equal(c.timing, 0);
  assert.equal(c.priceQuestions, 1);
  assert.equal(p.fee, null);
  assert.equal(p.floristApproved, true);
  assert.equal(p.version, 3);
});
test("duplicate and stale replies cannot overwrite accepted facts", () => {
  const accepted = acceptRevision(DEMO, 2);
  assert.throws(() => acceptRevision(accepted, 3), /already been accepted/);
  assert.throws(
    () => acceptRevision({ ...DEMO, version: 4, delivery: 570 }, 2),
    /plan changed/,
  );
  assert.throws(
    () => acceptRevision({ ...DEMO, replyStatus: "flagged" }, 2),
    /fresh review/,
  );
});
test("unknown facts remain unknown, including missing duration and zero-cost delivery", () => {
  const c = evaluatePlan({ ...DEMO, delivery: null, loading: null, fee: 0 });
  assert.equal(c.ready, null);
  assert.equal(c.removed, null);
  assert.equal(c.unknownTiming, true);
  assert.equal(c.priceQuestions, 0);
});
test("exact boundaries are valid and delivery before access is flagged", () => {
  assert.equal(
    evaluatePlan({ ...DEMO, delivery: 630, pickup: 1350 }).timing,
    0,
  );
  assert.equal(
    evaluatePlan({ ...DEMO, ...PROPOSED, delivery: 500 }).earlyDelivery,
    40,
  );
});
test("malformed clock input is rejected", () => {
  assert.equal(minutes("22:15"), 1335);
  assert.throws(() => minutes("25:10"));
  assert.throws(() => minutes("09:70"));
  assert.throws(() => minutes("banana"));
});
