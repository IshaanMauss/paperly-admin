import type { NextApiRequest, NextApiResponse } from "next";

/** Writes one short line per browser Content-Security-Policy report to the server log. Nothing is stored. */
export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  try {
    const raw = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const report = raw?.["csp-report"] ?? raw?.body ?? raw ?? {};
    const blocked = String(report["blocked-uri"] ?? report.blockedURL ?? "").slice(0, 200);
    const directive = String(report["violated-directive"] ?? report.effectiveDirective ?? "").slice(0, 80);
    console.warn(`[csp] ${directive} blocked ${blocked || "(inline)"}`);
  } catch {
    // A malformed report is not worth an error.
  }
  return res.status(204).end();
}
