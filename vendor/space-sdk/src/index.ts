import type { ZodType } from "zod";
import { z } from "zod";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export { z };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySchema = Record<string, any>;

export type Ctx = {
  db: <TSchema extends AnySchema = AnySchema>() => NodePgDatabase<TSchema>;
  invalidateQueries: () => void;
};

export type ActionDefinition<TReq extends ZodType, TRes extends ZodType> = {
  description: string;
  request: TReq;
  response: TRes;
  handler: (ctx: Ctx, args: z.infer<TReq>) => Promise<z.infer<TRes>>;
};

export function defineAction<TReq extends ZodType, TRes extends ZodType>(
  def: ActionDefinition<TReq, TRes>,
): ActionDefinition<TReq, TRes> {
  return def;
}

export type ActionsModule = Record<string, ActionDefinition<ZodType, ZodType>>;
