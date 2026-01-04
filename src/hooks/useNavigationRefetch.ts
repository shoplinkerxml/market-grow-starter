import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export function useNavigationRefetch() {
  const queryClient = useQueryClient();
  const location = useLocation();
  useEffect(() => {
    const p = location.pathname.toLowerCase();
    const delay = 150;
    const timer = setTimeout(async () => {
      // Tariffs and suppliers
      if (p.includes("/user/tariff")) {
        await queryClient.refetchQueries({ queryKey: ["tariffs", "list"], exact: false });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [location.pathname, queryClient]);
}
