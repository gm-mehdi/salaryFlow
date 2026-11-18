import { useQueryClient } from "@tanstack/react-query";

export function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["state"] });
}
