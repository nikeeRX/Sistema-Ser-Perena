import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  BarChart3,
  Users,
  Scissors,
  Package,
  Calendar,
  TrendingUp,
  LogOut,
  ChevronDown,
  Building2,
  Menu,
  X,
  CalendarClock,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardNavProps {
  branchId: number;
  branchName: string;
}

export default function DashboardNav({ branchId, branchName }: DashboardNavProps) {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const localUser = JSON.parse(localStorage.getItem("user") || "{}");
  const displayName = user?.name || localUser?.name || "Usuário";
  const displayEmail = user?.email || localUser?.email || "";
  const userRole = localUser?.role || "user";

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Menu items based on role
  const menuItems = useMemo(() => {
    const allItems = [
      { icon: BarChart3, label: "Dashboard", path: `/dashboard/${branchId}`, roles: ["admin", "owner", "user"] },
      { icon: CalendarClock, label: "Agenda", path: `/dashboard/${branchId}/scheduling`, roles: ["admin", "owner", "user", "barber"] },
      { icon: Calendar, label: "Atendimentos", path: `/dashboard/${branchId}/appointments`, roles: ["admin", "owner", "user"] },
      { icon: Users, label: "Barbeiros", path: `/dashboard/${branchId}/barbers`, roles: ["admin", "owner", "user"] },
      { icon: Scissors, label: "Serviços", path: `/dashboard/${branchId}/services`, roles: ["admin", "owner", "user"] },
      { icon: Package, label: "Produtos", path: `/dashboard/${branchId}/products`, roles: ["admin", "owner", "user"] },
      { icon: TrendingUp, label: "Comissões", path: `/dashboard/${branchId}/commissions`, roles: ["admin", "owner", "user", "barber"] },
    ];

    return allItems.filter(item => item.roles.includes(userRole));
  }, [branchId, userRole]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // ignore server logout errors
    }
    localStorage.removeItem("user");
    localStorage.removeItem("tokenActivated");
    setLocation("/");
  };

  const isActive = (path: string) => location === path;

  // Role badge
  const roleBadge = useMemo(() => {
    switch (userRole) {
      case "admin": return { label: "Admin", color: "bg-red-500/20 text-red-400" };
      case "owner": return { label: "Dono", color: "bg-blue-500/20 text-blue-400" };
      case "barber": return { label: "Barbeiro", color: "bg-green-500/20 text-green-400" };
      default: return { label: "Usuário", color: "bg-gray-500/20 text-gray-400" };
    }
  }, [userRole]);

  const navContent = (
    <>
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-sidebar-border flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-sidebar-foreground">Barbearia</h1>
          <p className="text-sidebar-foreground/50 text-xs lg:text-sm mt-1">Control System</p>
        </div>
        {/* Close button on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-sidebar-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Branch Selector */}
      <div className="p-3 lg:p-4 border-b border-sidebar-border">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/50 text-sm"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{branchName}</span>
              </div>
              <ChevronDown className="w-4 h-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setLocation("/units")}>
              Mudar Unidade
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-3 lg:py-4">
        <div className="space-y-1 px-2 lg:px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                variant="ghost"
                className={`w-full justify-start gap-3 transition-colors text-sm lg:text-base ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
                }`}
                onClick={() => {
                  setLocation(item.path);
                  setMobileOpen(false);
                }}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* User Profile */}
      <div className="p-3 lg:p-4 border-t border-sidebar-border">
        <div className="mb-3 lg:mb-4 p-2 lg:p-3 bg-sidebar-accent/30 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sidebar-foreground font-medium truncate text-sm">{displayName}</p>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${roleBadge.color}`}>
              {roleBadge.label}
            </span>
          </div>
          {displayEmail && (
            <p className="text-xs text-sidebar-foreground/50 truncate">{displayEmail}</p>
          )}
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-red-400 border-red-400/20 hover:bg-red-400/10 hover:text-red-300 text-sm"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Barbearia</h1>
            <p className="text-xs text-sidebar-foreground/50 -mt-0.5">{branchName}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-300"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Desktop: fixed, Mobile: slide-in */}
      <nav
        className={`
          fixed left-0 top-0 h-screen z-50 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl
          transition-transform duration-300 ease-in-out
          w-64 lg:w-64
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {navContent}
      </nav>
    </>
  );
}
