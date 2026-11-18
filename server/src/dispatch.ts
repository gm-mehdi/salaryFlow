import type { ZodType } from "zod";
import type { ActionsModule, Ctx } from "@hatch/space-sdk";
import { Actions } from "./actions";
import { db } from "./db";

export type DispatchResult =
  | { ok: true; status: 200; body: unknown }
  | { ok: false; status: 400 | 404 | 405; body: { error: string } };

const ctx: Ctx = {
  db: () => db as never,
  invalidateQueries: () => {},
};

export async function dispatchAction(
  method: string,
  rawBody: unknown,
): Promise<DispatchResult> {
  if (method !== "POST") {
    return { ok: false, status: 405, body: { error: "Method not allowed" } };
  }

  const body = rawBody as { action?: string; args?: unknown };
  const name = body?.action;
  if (!name || typeof name !== "string") {
    return { ok: false, status: 400, body: { error: "Missing action name" } };
  }

  const actions = Actions as ActionsModule;
  const action = actions[name];
  if (!action) {
    return { ok: false, status: 404, body: { error: `Unknown action: ${name}` } };
  }

  try {
    const parsed = (action.request as ZodType).parse(body.args ?? {});
    const result = await action.handler(ctx, parsed);
    return { ok: true, status: 200, body: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[actions] ${name} failed:`, err);
    return { ok: false, status: 400, body: { error: message } };
  }
}
