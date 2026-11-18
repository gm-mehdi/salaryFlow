/** Stub — local builds use Vite instead of the Muse SDK bundler. */
export async function buildClient(): Promise<void> {
  throw new Error(
    "buildClient() is not used locally. Run `pnpm build` (Vite) instead.",
  );
}
