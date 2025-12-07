import { FC } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Unauthorized: FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Unauthorized</h1>
        <p className="text-muted-foreground">
          You don't have permission to access this page.
        </p>

        <div className="space-x-2">
          <Link to="/">
            <Button variant="default">Go Home</Button>
          </Link>

          <Link to="/store/login">
            <Button variant="secondary">Store Login</Button>
          </Link>

          <Link to="/admin/login">
            <Button variant="secondary">Admin Login</Button>
          </Link>

          <Link to="/inventory/login">
            <Button variant="secondary">Inventory Login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
