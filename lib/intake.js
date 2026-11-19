/* Shared helpers for the OpenGate Data form intake. No secrets live in this file:
   everything sensitive comes from environment variables set on the host. */
import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 12;
export const STATEMENT_PREFIX = "statements/";

export function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing environment variable ${name}`);
  }
  return v;
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/* Only accept calls from our own site (and local testing). */
export function originAllowed(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin form posts and server-to-server calls
  const allowed = env("ALLOWED_ORIGINS", "https://www.opengatedata.com,https://opengatedata.com")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) return true;
  if (process.env.VERCEL_BRANCH_URL && origin === `https://${process.env.VERCEL_BRANCH_URL}`) return true;
  return false;
}

/* ---- Signed, expiring file links ---- */
function sign(pathname, expires) {
  return createHmac("sha256", env("FILE_LINK_SECRET")).update(`${pathname}\n${expires}`).digest("base64url");
}

export function signedFileUrl(siteUrl, pathname, days) {
  const expires = Math.floor(Date.now() / 1000) + Math.round(days * 86400);
  const q = new URLSearchParams({ p: pathname, e: String(expires), s: sign(pathname, expires) });
  return `${siteUrl.replace(/\/$/, "")}/api/file?${q}`;
}

export function verifyFileLink(pathname, expires, signature) {
  if (!pathname || !expires || !signature) return false;
  if (!pathname.startsWith(STATEMENT_PREFIX) || pathname.includes("..")) return false;
  const exp = Number(expires);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(pathname, exp));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/* ---- Field cleaning ---- */
export function clean(value, max = 500) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FORMS = {
  broker: {
    boardEnv: "MONDAY_BROKER_BOARD_ID",
    groupEnv: "MONDAY_BROKER_GROUP_ID",
    columnsEnv: "MONDAY_BROKER_COLUMNS",
    required: ["broker_name", "broker_company", "broker_email", "broker_phone", "merchant_business", "merchant_state", "merchant_contact", "positions", "total_debt", "monthly_obligation", "contact_preference", "merchant_authorization", "contact_consent"],
    email: "broker_email",
    consent: ["merchant_authorization", "contact_consent"],
    allowsFiles: true,
    itemName: (f) => `${f.merchant_business} (via ${f.broker_company})`,
    labels: {
      broker_name: "Broker name", broker_company: "Company / ISO", broker_email: "Broker email", broker_phone: "Broker phone",
      merchant_business: "Merchant legal name", merchant_state: "State", merchant_contact: "Merchant contact", merchant_phone: "Merchant phone",
      positions: "MCA positions", total_debt: "Total MCA debt", monthly_obligation: "Combined monthly obligation", frequency: "Payment frequency",
      decline_reason: "Decline reason", contact_preference: "Merchant contact preference",
      merchant_authorization: "Broker confirmed merchant authorization", contact_consent: "Broker agreed to be contacted",
    },
  },
  gateway: {
    boardEnv: "MONDAY_GATEWAY_BOARD_ID",
    groupEnv: "MONDAY_GATEWAY_GROUP_ID",
    columnsEnv: "MONDAY_GATEWAY_COLUMNS",
    required: ["role", "name", "email", "phone", "business_name", "state", "positions", "balance", "monthly", "consent"],
    email: "email",
    consent: ["consent"],
    allowsFiles: false,
    itemName: (f) => `${f.business_name} (${f.role})`,
    labels: {
      role: "Submitted by", name: "Name", company: "Company", email: "Email", phone: "Phone",
      business_name: "Business", state: "State", positions: "MCA positions", balance: "Total MCA balance",
      monthly: "Combined monthly payments", notes: "Notes", consent: "Agreed to be contacted",
    },
  },
};

/* Returns { fields, files, errors } */
export function validateSubmission(kind, body) {
  const spec = FORMS[kind];
  const errors = [];
  if (!spec) return { errors: ["Unknown form."] };
  const fields = {};
  for (const key of Object.keys(spec.labels)) fields[key] = clean(body?.fields?.[key], key === "notes" || key === "decline_reason" ? 2000 : 300);
  for (const key of spec.required) if (!fields[key]) errors.push(`${spec.labels[key]} is required.`);
  for (const key of spec.consent) if (fields[key] && fields[key] !== "yes") errors.push(`${spec.labels[key]} must be confirmed.`);
  if (fields[spec.email] && !EMAIL.test(fields[spec.email])) errors.push("Email address is not valid.");

  let files = [];
  if (spec.allowsFiles && Array.isArray(body?.files)) {
    files = body.files.slice(0, MAX_FILES).map((f) => ({
      pathname: clean(f?.pathname, 400),
      name: clean(f?.name, 200),
      size: Number(f?.size) || 0,
    }));
    for (const f of files) {
      if (!f.pathname.startsWith(STATEMENT_PREFIX) || f.pathname.includes("..")) errors.push("A file reference is not valid.");
      if (f.size > MAX_FILE_BYTES) errors.push(`${f.name} is too large.`);
    }
  }
  return { fields, files, errors };
}

/* Plain-text summary posted as the item's first update. */
export function summaryText(kind, fields, fileLinks, linkDays) {
  const spec = FORMS[kind];
  const lines = [`New ${kind === "broker" ? "broker submission" : "Gateway review request"} from the OpenGate Data website`, ""];
  for (const [key, label] of Object.entries(spec.labels)) if (fields[key]) lines.push(`${label}: ${fields[key]}`);
  if (fileLinks.length) {
    lines.push("", `Bank statements (secure links, valid ${linkDays} days):`);
    for (const f of fileLinks) lines.push(`• ${f.name}: ${f.url}`);
  }
  lines.push("", `Submitted ${new Date().toISOString()}`);
  return lines.join("\n");
}

/* Optional column mapping, e.g. MONDAY_BROKER_COLUMNS='{"broker_email":{"id":"email_mkx1","type":"email"}}' */
export function columnValues(kind, fields) {
  const raw = process.env[FORMS[kind].columnsEnv];
  if (!raw) return {};
  let map;
  try { map = JSON.parse(raw); } catch { return {}; }
  const out = {};
  for (const [field, col] of Object.entries(map)) {
    const v = col?.value ?? fields[field];   // "value" sets a fixed value, e.g. a starting status
    if (!v || !col?.id) continue;
    if (col.type === "email") out[col.id] = { email: v, text: v };
    else if (col.type === "phone") out[col.id] = { phone: v.replace(/[^\d+]/g, ""), countryShortName: "US" };
    else if (col.type === "status" || col.type === "dropdown") out[col.id] = { label: v };
    else out[col.id] = v;
  }
  return out;
}

/* ---- monday.com ---- */
export async function monday(query, variables) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: env("MONDAY_API_TOKEN"),
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors || data.error_message) {
    const msg = data.errors?.map((e) => e.message).join("; ") || data.error_message || `HTTP ${res.status}`;
    throw new Error(`monday: ${msg}`);
  }
  return data.data;
}

export async function createMondayItem({ boardId, groupId, itemName, columns, update }) {
  const create = (cols) => monday(
    `mutation ($board: ID!, $group: String, $name: String!, $cols: JSON) {
       create_item (board_id: $board, group_id: $group, item_name: $name, column_values: $cols, create_labels_if_missing: true) { id }
     }`,
    { board: String(boardId), group: groupId || null, name: itemName.slice(0, 250), cols: JSON.stringify(cols || {}) }
  );
  let created;
  try {
    created = await create(columns);
  } catch (err) {
    // A rejected column value (e.g. an unusual phone format) must not lose the lead:
    // retry with no column values; the full details still go in the update below.
    if (!columns || !Object.keys(columns).length) throw err;
    console.warn("monday column values rejected, retrying without them:", err.message);
    created = await create({});
  }
  const itemId = created.create_item.id;
  await monday(
    `mutation ($item: ID!, $body: String!) { create_update (item_id: $item, body: $body) { id } }`,
    { item: itemId, body: update.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>") }
  );
  return itemId;
}
