/* POST /api/upload
   Issues short-lived upload tokens so the browser can send bank statements straight
   into the private Blob store (bypassing the ~4.5 MB function body limit).
   Only PDFs, only under statements/, max 25 MB each. */
import { handleUpload } from "@vercel/blob/client";
import { json, originAllowed, MAX_FILE_BYTES, STATEMENT_PREFIX } from "../lib/intake.js";

export async function POST(request) {
  if (!originAllowed(request)) return json({ error: "Forbidden" }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(STATEMENT_PREFIX) || pathname.includes("..") || !/\.pdf$/i.test(pathname)) {
          throw new Error("Only PDF statements can be uploaded.");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return json(result);
  } catch (err) {
    return json({ error: err.message || "Upload not allowed" }, 400);
  }
}
