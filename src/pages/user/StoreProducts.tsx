import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export const StoreProducts = () => {
  const { id } = useParams();
  const storeId = id ? String(id) : "";
  const navigate = useNavigate();
  useEffect(() => {
    if (storeId) navigate(`/user/shops/${storeId}`, { replace: true });
    else navigate("/user/shops", { replace: true });
  }, [storeId, navigate]);

  return null;
};

export default StoreProducts;
