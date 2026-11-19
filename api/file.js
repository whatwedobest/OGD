/* GET /api/file?p=<pathname>&e=<expires>&s=<signature>
   Streams a private bank statement to someone holding a valid, unexpired signed link
   (the links posted on monday items). Anything else gets a 404. */
import { get } from "@vercel/blob";
import { verifyFileLink } from "../lib/intake.js";

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const pathname = q.get("p");
  if (!verifyFileLink(pathname, q.get("e"), q.get("s"))) {
    return new Response("This link is invalid or has expired. Ask the OpenGate team for a new one.", {
      status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const result = await get(pathname, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });

  const filename = pathname.split("/").pop().replace(/[^\w.\-]/g, "_");
  return new Response(result.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
