import { FC } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

interface ProtectedRouteProps {
  allowedRoles: string[];
  loginPath: string;
}

const ProtectedRoute: FC<ProtectedRouteProps> = ({ allowedRoles, loginPath }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
