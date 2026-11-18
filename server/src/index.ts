import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { ZodType } from "zod";
import type { ActionsModule, Ctx } from "@hatch/space-sdk";
import { Actions } from "./actions";
import { db, migrate } from "./db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const port = Number(process.env.PORT ?? 5174);
const isProd = process.env.NODE_ENV === "production";
const clientDist = path.join(root, "client/dist");

const ctx: Ctx = {
  db: () => db as never,
  invalidateQueries: () => {},
};

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".png":
      return "image/png";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

async function handleActions(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  let body: { action?: string; args?: unknown };
  try {
    body = JSON.parse(await readBody(req)) as { action?: string; args?: unknown };
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const name = body.action;
  if (!name || typeof name !== "string") {
    sendJson(res, 400, { error: "Missing action name" });
    return;
  }

  const actions = Actions as ActionsModule;
  const action = actions[name];
  if (!action) {
    sendJson(res, 404, { error: `Unknown action: ${name}` });
    return;
  }

  try {
    const parsed = (action.request as ZodType).parse(body.args ?? {});
    const result = await action.handler(ctx, parsed);
    res.setHeader("Access-Control-Allow-Origin", "*");
    sendJson(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[actions] ${name} failed:`, err);
    sendJson(res, 400, { error: message });
  }
}

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  let filePath = path.join(clientDist, decodeURIComponent(url.pathname));
  if (url.pathname === "/" || !path.extname(filePath)) {
    filePath = path.join(clientDist, "index.html");
  }
  if (!filePath.startsWith(clientDist) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404).end("Not found");
    return;
  }
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(data);
}

async function main(): Promise<void> {
  await migrate();

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = req.url ?? "/";
        if (url === "/actions" || url.startsWith("/actions?")) {
          await handleActions(req, res);
          return;
        }
        if (url === "/health") {
          sendJson(res, 200, { ok: true });
          return;
        }
        if (isProd) {
          serveStatic(req, res);
          return;
        }
        res.writeHead(404).end("Not found — use the Vite dev server on :5173");
      } catch (err) {
        console.error(err);
        if (!res.headersSent) sendJson(res, 500, { error: "Internal server error" });
      }
    })();
  });

  server.listen(port, () => {
    console.log(`[salaryflow] API listening on http://localhost:${port}`);
    if (isProd) {
      console.log(`[salaryflow] serving client from ${clientDist}`);
    }
  });
}

void main().catch((err) => {
  console.error("[salaryflow] failed to start:", err);
  process.exit(1);
});
