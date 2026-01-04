import { useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { FullPageLoader } from "@/components/LoadingSkeletons";
import { Circle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { role, loading } = useUserRole();
  const [shouldRedirect, setShouldRedirect] = useState(null);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );

    // Проверяем, является ли путь админским или похожим на админский
    const path = location.pathname.toLowerCase();
    const isAdminPath = path.startsWith('/admin');
    
    // Проверяем на возможные опечатки в админских путях
    const adminPathVariants = [
      '/admin-auth', '/admin-register', '/admin-login',
      '/гыук-auth', '/фвьшт-auth', // возможные опечатки на русской раскладке
      '/admin', '/admn', '/admi', '/amin' // другие возможные опечатки
    ];
    
    const isPossibleAdminPath = adminPathVariants.some(variant => 
      path.includes('admin') || path.includes('гыук') || path.includes('фвьшт')
    );
    
    if (!loading) {
      // Если пользователь не авторизован (role === null), редиректим
      if (role === null) {
        if (isAdminPath || isPossibleAdminPath) {
          // Если это админский путь - редиректим на админскую авторизацию
          setShouldRedirect('/admin-auth');
        } else {
          // Если не можем понять кто это - редиректим на пользовательскую авторизацию
          setShouldRedirect('/user-auth');
        }
      }
    }
  }, [location.pathname, role, loading]);

  // Показываем загрузку пока определяется роль
  if (loading) {
    return (
      <FullPageLoader title="Завантаження…" subtitle="Перевіряємо доступ" icon={Circle} />
    );
  }

  // Редиректим на соответствующую авторизацию если нужно
  if (shouldRedirect) {
    return <Navigate to={shouldRedirect} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <a href="/" className="text-primary hover:underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;

