export const DEMO = {
  name: "Community Dinner",
  date: "2026-10-24",
  venue: "The Glasshouse",
  guests: 120,
  zone: "Africa/Lagos",
  isDemo: true,
  version: 2,
  delivery: 690,
  pickup: 1410,
  setup: 90,
  loading: 30,
  arrival: 720,
  accessStart: 540,
  accessEnd: 1380,
  fee: null,
  floristApproved: true,
  replyStatus: "pending",
  draft: "",
};
export const PROPOSED = { delivery: 600, pickup: 1335 };
export function time(value) {
  if (value === null || value === undefined) return "Not stated";
  return `${String(Math.floor(value / 60) % 24).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}${value >= 1440 ? " next day" : ""}`;
}
export function minutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error("Enter a time as HH:MM.");
  const [h, m] = value.split(":").map(Number);
  if (h > 23 || m > 59) throw new Error("Enter a valid time.");
  return h * 60 + m;
}
export function evaluatePlan(p) {
  const ready =
    p.delivery == null || p.setup == null ? null : p.delivery + p.setup;
  const removed =
    p.pickup == null || p.loading == null ? null : p.pickup + p.loading;
  const cateringLate =
    ready == null || p.arrival == null ? null : Math.max(0, ready - p.arrival);
  const removalLate =
    removed == null || p.accessEnd == null
      ? null
      : Math.max(0, removed - p.accessEnd);
  const earlyDelivery =
    p.delivery == null || p.accessStart == null
      ? null
      : Math.max(0, p.accessStart - p.delivery);
  return {
    ready,
    removed,
    cateringLate,
    removalLate,
    earlyDelivery,
    timing: [cateringLate, removalLate, earlyDelivery].filter((x) => x > 0)
      .length,
    unknownTiming: [cateringLate, removalLate, earlyDelivery].some(
      (x) => x === null,
    ),
    priceQuestions: p.fee === null ? 1 : 0,
  };
}
export function acceptRevision(p, expectedVersion) {
  if (p.version !== expectedVersion)
    throw new Error(
      "The plan changed while you were reviewing. Reopen the reply to compare the latest facts.",
    );
  if (p.replyStatus === "accepted")
    throw new Error("This reply has already been accepted.");
  if (p.replyStatus !== "pending" || p.version !== 2)
    throw new Error(
      "This reply needs a fresh review before it can be applied.",
    );
  return { ...p, ...PROPOSED, version: p.version + 1, replyStatus: "accepted" };
}
export const SOURCES = [
  {
    key: "venue",
    name: "The Glasshouse",
    kind: "Venue rules",
    label: "Venue rules · access",
    text: "Venue access begins at 09:00. All equipment must be removed by 23:00.",
    facts: [
      "Access opens · 09:00",
      "Equipment removed by · 23:00",
      "Venue charge · Not stated",
    ],
  },
  {
    key: "juniper",
    name: "Juniper Rentals",
    kind: "Proposal · Rev 2",
    label: "Juniper proposal · Rev 2",
    text: "Delivery complete: 11:30. Pickup starts: 23:30. Loading duration: 30 minutes. Rental subtotal: $3,450, excluding delivery. Delivery charge: not stated.",
    facts: [
      "Delivery complete · 11:30",
      "Pickup starts · 23:30",
      "Loading · 30 minutes",
      "Delivery charge · Not stated",
    ],
  },
  {
    key: "olive",
    name: "Olive Kitchen",
    kind: "Setup requirements",
    label: "Olive Kitchen · setup",
    text: "We require 90 minutes of setup after the rental delivery is complete. Catering: $8,200.",
    facts: ["Setup after delivery · 90 minutes"],
  },
  {
    key: "meadow",
    name: "Meadow Florals",
    kind: "Approved choice",
    label: "Meadow Florals · choice",
    text: "Meadow Florals is the approved florist choice. Stated amount: $1,850. This approval is independent of the rental delivery and pickup times.",
    facts: ["Florist choice · Approved", "Stated amount · $1,850"],
  },
  {
    key: "reply",
    name: "Juniper Rentals",
    kind: "Reply · Rev 3",
    label: "Juniper reply · Rev 3",
    text: "We can complete delivery by 10:00 and start pickup at 22:15. Loading takes 30 minutes.",
    facts: [
      "Proposed delivery complete · 10:00",
      "Proposed pickup starts · 22:15",
      "Delivery charge · Not addressed",
    ],
  },
];
export const DEFAULT_DRAFT =
  "Hi Juniper,\n\nThanks for the revised delivery and pickup times for our Community Dinner on 24 October. Please confirm the delivery charge in USD and whether there are any additional collection charges. The $3,450 rental subtotal excludes delivery.\n\nThank you!";
