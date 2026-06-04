import React from "react";
import { Link, useLocation } from "wouter";
import { Home, History, Wallet, Trophy, ListTodo, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTelegram } from "@/lib/telegram";

const ADMIN_ID = import.meta.env.VITE_ADMIN_TELEGRAM_ID as string;

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location] = useLocation();
  const { user } = useTelegram();
  const isAdmin = !!user?.id && user.id === ADMIN_ID;

  const navItems = [
    { href: "/", icon: Home, label: "Earn" },
    { href: "/tasks", icon: ListTodo, label: "Tasks" },
    { href: "/history", icon: History, label: "History" },
    { href: "/withdraw", icon: Wallet, label: "Withdraw" },
    { href: "/leaderboard", icon: Trophy, label: "Rank" },
    ...(isAdmin ? [{ href: "/admin", icon: ShieldAlert, label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center">
      <div className="w-full max-w-[428px] h-[100dvh] flex flex-col relative overflow-hidden shadow-2xl">
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>

        <nav className="absolute bottom-0 w-full bg-card/95 backdrop-blur-md border-t border-border flex items-center h-16 z-50 px-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 h-full"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 transition-all duration-200",
                    isActive ? "text-primary scale-110" : "text-muted-foreground"
                  )}
                />
                <span className={cn(
                  "text-[9px] font-medium transition-colors leading-tight",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
