import { useEffect, useState } from "react";
import { UserMenuService } from "@/lib/user-menu-service";

const TestMenuItems = () => {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        setLoading(true);
        // Use a dummy user ID for testing
        const items = await UserMenuService.getUserMenuItems("test-user-id");
        setMenuItems(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadMenuItems();
  }, []);

  if (loading) {
    return <div>Loading menu items...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Menu Items Test</h2>
      <p>Found {menuItems.length} menu items</p>
      <ul>
        {menuItems.map((item) => (
          <li key={item.id}>
            {item.title} - {item.path}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TestMenuItems;