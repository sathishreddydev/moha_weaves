import { BRAND_NAME } from "@/lib/brand";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface LoginLayoutProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  features: string[];
  children: ReactNode;
}

export function LoginLayout({
  icon: Icon,
  title,
  subtitle,
  features,
  children,
}: LoginLayoutProps) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left - Branding & Info */}
      <div className="hidden lg:flex flex-col justify-center px-12 xl:px-20 border-r">
        <div className="max-w-md">
          <Link to="/" className="inline-block mb-10">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {BRAND_NAME}
            </h1>
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-medium">{title}</h2>
          </div>

          <p className="text-muted-foreground mb-8">{subtitle}</p>

          <ul className="space-y-3">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile only brand */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/">
              <h1 className="font-serif text-2xl font-semibold tracking-tight">
                {BRAND_NAME}
              </h1>
            </Link>
            <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-sm">{title}</span>
            </div>
          </div>

          {children}

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
