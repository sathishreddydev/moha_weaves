import { NavLink } from "react-router-dom";
import { AdminNavGroups } from "./NavItems";

export function AdminSidebar() {
  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 p-3 space-y-4">
        {AdminNavGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <h3 className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {group.title}
            </h3>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                data-testid={`nav-${item.label
                  .toLowerCase()
                  .replace(/\s/g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 h-7 text-xs px-2 rounded-md w-full
                  ${
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}
