import { test } from "node:test";
import assert from "node:assert/strict";

process.env.FILE_LINK_SECRET = "test-secret";
process.env.MONDAY_API_TOKEN = "test-token";
process.env.MONDAY_BROKER_BOARD_ID = "111";
process.env.MONDAY_GATEWAY_BOARD_ID = "222";
process.env.SITE_URL = "https://www.opengatedata.com";

const lib = await import("../lib/intake.js");
const { POST: submit } = await import("../api/submit.js");
const { GET: file } = await import("../api/file.js");

const broker = {
  broker_name: "Pat Broker", broker_company: "Acme ISO", broker_email: "pat@example.com", broker_phone: "555-0100",
  merchant_business: "Sunrise Cafe LLC", merchant_state: "FL", merchant_contact: "Owner", positions: "3",
  total_debt: "$30,000–$75,000", monthly_obligation: "$8,000–$20,000", contact_preference: "Keep me anonymous",
  merchant_authorization: "yes", contact_consent: "yes",
};

test("valid broker submission passes; missing consent fails", () => {
  assert.deepEqual(lib.validateSubmission("broker", { fields: broker }).errors, []);
  const bad = lib.validateSubmission("broker", { fields: { ...broker, merchant_authorization: "" } });
  assert.ok(bad.errors.some((e) => e.includes("merchant authorization")));
});

test("rejects bad email, unknown form, and file paths outside statements/", () => {
  assert.ok(lib.validateSubmission("broker", { fields: { ...broker, broker_email: "nope" } }).errors.length);
  assert.ok(lib.validateSubmission("other", {}).errors.length);
  const r = lib.validateSubmission("broker", { fields: broker, files: [{ pathname: "../secret.pdf", name: "x", size: 1 }] });
  assert.ok(r.errors.some((e) => e.includes("not valid")));
});

test("signed links verify, and fail when tampered or expired", () => {
  const url = new URL(lib.signedFileUrl("https://www.opengatedata.com", "statements/abc/jan.pdf", 30));
  const p = url.searchParams;
  assert.equal(url.pathname, "/api/file");
  assert.ok(lib.verifyFileLink(p.get("p"), p.get("e"), p.get("s")));
  assert.ok(!lib.verifyFileLink("statements/abc/other.pdf", p.get("e"), p.get("s")));
  assert.ok(!lib.verifyFileLink(p.get("p"), String(Math.floor(Date.now() / 1000) - 10), p.get("s")));
  assert.ok(!lib.verifyFileLink("other/abc.pdf", p.get("e"), p.get("s")));
});

test("file route returns 404 for an invalid link", async () => {
  const res = await file(new Request("https://www.opengatedata.com/api/file?p=statements/a.pdf&e=1&s=bad"));
  assert.equal(res.status, 404);
});

test("honeypot submissions are accepted silently and never reach monday", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("{}"); };
  const res = await submit(new Request("https://x/api/submit", { method: "POST", body: JSON.stringify({ form: "broker", fields: broker, website: "spam" }) }));
  assert.equal(res.status, 200);
  assert.equal(called, false);
});

test("blocks requests from other websites", async () => {
  const res = await submit(new Request("https://x/api/submit", { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" }));
  assert.equal(res.status, 403);
});

test("broker submission creates a monday item on the broker board with a summary update", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, auth: init.headers.Authorization, body });
    const data = body.query.includes("create_item") ? { create_item: { id: "999" } } : { create_update: { id: "1" } };
    return new Response(JSON.stringify({ data }), { status: 200 });
  };
  const res = await submit(new Request("https://x/api/submit", {
    method: "POST", headers: { origin: "https://www.opengatedata.com" },
    body: JSON.stringify({ form: "broker", fields: broker, files: [] }),
  }));
  const out = await res.json();
  assert.equal(res.status, 200, JSON.stringify(out));
  assert.equal(out.ref, "999");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://api.monday.com/v2");
  assert.equal(calls[0].auth, "test-token");
  assert.equal(calls[0].body.variables.board, "111");
  assert.equal(calls[0].body.variables.name, "Sunrise Cafe LLC (via Acme ISO)");
  assert.match(calls[1].body.variables.body, /Merchant contact preference: Keep me anonymous/);
});

test("gateway inquiry goes to the gateway board; monday errors return a friendly 502", async () => {
  const gw = { role: "Business owner", name: "Sam", email: "sam@example.com", phone: "555", business_name: "Sam's Shop", state: "FL", positions: "4", balance: "$75,000–$150,000", monthly: "$8,000–$20,000", consent: "yes" };
  let board;
  globalThis.fetch = async (u, init) => { board = JSON.parse(init.body).variables.board; return new Response(JSON.stringify({ errors: [{ message: "boom" }] }), { status: 200 }); };
  const res = await submit(new Request("https://x/api/submit", { method: "POST", body: JSON.stringify({ form: "gateway", fields: gw }) }));
  assert.equal(board, "222");
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /couldn't send/);
});

test("fixed column values and fallback when monday rejects column values", async () => {
  process.env.MONDAY_BROKER_COLUMNS = JSON.stringify({ broker_email: { id: "email_x", type: "email" }, _status: { id: "color_x", type: "status", value: "New" } });
  const cols = lib.columnValues("broker", broker);
  assert.deepEqual(cols.color_x, { label: "New" });
  assert.equal(cols.email_x.email, "pat@example.com");
  const seen = [];
  globalThis.fetch = async (u, init) => {
    const b = JSON.parse(init.body);
    if (b.query.includes("create_item")) {
      seen.push(b.variables.cols);
      if (seen.length === 1) return new Response(JSON.stringify({ errors: [{ message: "invalid phone" }] }), { status: 200 });
      return new Response(JSON.stringify({ data: { create_item: { id: "5" } } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: { create_update: { id: "1" } } }), { status: 200 });
  };
  const res = await submit(new Request("https://x/api/submit", { method: "POST", body: JSON.stringify({ form: "broker", fields: broker }) }));
  assert.equal(res.status, 200);
  assert.equal(seen.length, 2);
  assert.equal(seen[1], "{}");
  delete process.env.MONDAY_BROKER_COLUMNS;
});
