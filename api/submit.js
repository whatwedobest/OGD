/* POST /api/submit  { form: "broker" | "gateway", fields: {...}, files: [{pathname, name, size}], website: "" }
   Validates the submission, builds signed expiring links to any uploaded statements,
   and creates an item on the matching monday.com board with the details as its first update.
   Statements are never attached to monday; only links to the private store are sent. */
import { head } from "@vercel/blob";
import {
  json, env, originAllowed, validateSubmission, signedFileUrl, summaryText,
  columnValues, createMondayItem, FORMS,
} from "../lib/intake.js";

export async function POST(request) {
  if (!originAllowed(request)) return json({ error: "Forbidden" }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }

  // Honeypot: real visitors never fill this hidden field.
  if (body?.website) return json({ ok: true });

  const kind = body?.form;
  if (!FORMS[kind]) return json({ error: "Unknown form" }, 400);

  const { fields, files, errors } = validateSubmission(kind, body);
  if (errors.length) return json({ error: errors.join(" ") }, 422);

  try {
    // Confirm every referenced statement really exists in the private store.
    for (const f of files) {
      const meta = await head(f.pathname).catch(() => null);
      if (!meta) return json({ error: `We couldn't find the uploaded file ${f.name}. Please upload it again.` }, 422);
      f.size = meta.size;
    }

    const siteUrl = env("SITE_URL", "https://www.opengatedata.com");
    const linkDays = Number(env("FILE_LINK_DAYS", "30"));
    const fileLinks = files.map((f) => ({ name: f.name, url: signedFileUrl(siteUrl, f.pathname, linkDays) }));

    const spec = FORMS[kind];
    const itemId = await createMondayItem({
      boardId: env(spec.boardEnv),
      groupId: process.env[spec.groupEnv] || null,
      itemName: spec.itemName(fields),
      columns: columnValues(kind, fields),
      update: summaryText(kind, fields, fileLinks, linkDays),
    });
    return json({ ok: true, ref: itemId });
  } catch (err) {
    console.error("submit failed:", err.message);
    return json({ error: "We couldn't send your submission. Please try again or call (561) 223-1688." }, 502);
  }
}
