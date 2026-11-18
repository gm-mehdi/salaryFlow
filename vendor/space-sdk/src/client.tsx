import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ActionsModule } from "./index";
import type { z } from "zod";

type ClientFromActions<T extends ActionsModule> = {
  [K in keyof T]: (
    args: z.infer<T[K]["request"]>,
  ) => Promise<z.infer<T[K]["response"]>>;
};

export type ApiRequest<
  TClient,
  TName extends keyof TClient,
> = TClient[TName] extends (args: infer A) => unknown ? A : never;

export type ApiResponse<
  TClient,
  TName extends keyof TClient,
> = TClient[TName] extends (...args: never[]) => Promise<infer R> ? R : never;

const ACTIONS_URL = "/api/actions";

export function createActionClient<T extends ActionsModule>(): ClientFromActions<T> {
  return new Proxy({} as ClientFromActions<T>, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return async (args: unknown) => {
        const res = await fetch(ACTIONS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: prop, args: args ?? {} }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Action ${prop} failed (${res.status})`);
        }
        return res.json();
      };
    },
  });
}

export const spaceQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
});

/** Notch / safe-area scrim for mobile installs. */
export function SafeAreaTopScrim({
  backgroundColor = "transparent",
}: {
  backgroundColor?: string;
}): ReactNode {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "env(safe-area-inset-top, 0px)",
        backgroundColor,
        zIndex: 60,
        pointerEvents: "none",
      }}
    />
  );
}
