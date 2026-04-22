import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import {
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  RotateCcw,
  ShoppingBag,
  User
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore } from "../Store/useCartStore";
import { useWishlistStore } from "../Store/useWishlistStore";
import { OffersBanner } from "./OffersBanner";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Collections" },
  { href: "/sales", label: "Sales & Offers" },
  { href: "/categories", label: "Categories" },
];

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  const getCart = useCartStore((s) => s.getCart);
  const cartCount = useCartStore((s) => s.count);
  const wishlistCount = useWishlistStore((s) => s.count);
  const getWishlist = useWishlistStore((s) => s.getWishlist);

  useEffect(() => {
    if (user && cartCount === 0) {
      getCart();
      getWishlist();
    }
  }, [user]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);


  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const getDashboardLink = () => {
    if (!user) return null;
    switch (user.role) {
      case "admin":
        return "/admin/dashboard";
      case "inventory":
        return "/inventory/dashboard";
      case "store":
        return "/store/dashboard";
      default:
        return "/user/orders";
    }
  };

  return (
    <>
      <OffersBanner />
      <header
        className={`sticky top-0 w-full z-[100] transition-all duration-700 ${scrolled ? "bg-white/95 backdrop-blur-xl py-3 shadow-sm" : "bg-white/95 backdrop-blur-md py-3"}`}
      >
      <div className="max-w-[1800px] mx-auto px-8 flex justify-between items-center">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="text-primary hover:scale-110 transition-transform">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="flex flex-col gap-6 mt-8">
                  <Link
                    to="/"
                    className="font-serif text-2xl font-semibold text-primary"
                  >
                    Moha
                  </Link>
                  <nav className="flex flex-col gap-4">
                    {navLinks.map((link) => (
                      <SheetClose asChild key={link.href}>
                        <Link
                          to={link.href}
                          className="text-lg hover:text-primary"
                        >
                          {link.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>

            <h1
              className="text-2xl font-serif tracking-tighter transition-colors duration-500 text-primary"
            >
              <Link to="/">Moha</Link>
            </h1>
          </div>

          <nav className="hidden mt-3 lg:flex gap-8 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-500">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

          <div className={`flex items-center gap-6 transition-colors duration-500 text-primary`}>
          {user && user.role === "user" && (
            <>
              <Link to="/user/wishlist">
                <Button variant="ghost" size="icon" className="relative hover:scale-110 transition-transform">
                  <Heart className="h-5 w-5" />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-amber-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {wishlistCount}
                    </span>
                  )}
                </Button>
              </Link>

              <Link to="/user/cart">
                <Button variant="ghost" size="icon" className="relative hover:scale-110 transition-transform">
                  <ShoppingBag className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-amber-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </Link>
            </>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:scale-110 transition-transform">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                {user.role !== "user" && getDashboardLink() && (
                  <DropdownMenuItem asChild>
                    <Link to={getDashboardLink()!}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role === "user" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/user/orders"
                        className="cursor-pointer"
                        data-testid="link-orders"
                      >
                        <Package className="mr-2 h-4 w-4" />
                        My Orders
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/user/wishlist"
                        className="cursor-pointer"
                        data-testid="link-wishlist-menu"
                      >
                        <Heart className="mr-2 h-4 w-4" />
                        Wishlist
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/user/addresses"
                        className="cursor-pointer"
                        data-testid="link-addresses"
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        My Addresses
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/user/returns"
                        className="cursor-pointer"
                        data-testid="link-returns"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Returns
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/user/login">
              <Button variant="ghost" size="icon" className="hover:scale-110 transition-transform">
                <User className="h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
      </header>
    </>
  );
}
