"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, ChefHat, LayoutGrid, Menu as MenuIcon, UtensilsCrossed, X, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Lauad", icon: LayoutGrid, match: (p: string) => p === "/" || p.startsWith("/order") || p.startsWith("/receipt") },
  { href: "/kitchen", label: "Köök", icon: ChefHat, match: (p: string) => p.startsWith("/kitchen") },
  { href: "/menu", label: "Menüü", icon: UtensilsCrossed, match: (p: string) => p.startsWith("/menu") },
  { href: "/reports", label: "Aruanded", icon: BarChart3, match: (p: string) => p.startsWith("/reports") },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 text-white shadow-md print:hidden">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-4 px-3 sm:px-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500">
            <Store className="size-5" />
          </span>
          CompuCash <span className="font-normal text-emerald-400">Lite</span>
        </Link>
        <nav className="ml-auto hidden gap-1 md:flex">
          {links.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-lg px-4 font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white",
                match(pathname) && "bg-slate-800 text-white",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <button
          className="ml-auto flex size-12 items-center justify-center rounded-lg hover:bg-slate-800 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Sulge menüü" : "Ava menüü"}
          aria-expanded={open}
        >
          {open ? <X className="size-6" /> : <MenuIcon className="size-6" />}
        </button>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-slate-800 p-2 md:hidden">
          {links.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-lg px-4 text-lg font-semibold text-slate-200 hover:bg-slate-800",
                match(pathname) && "bg-slate-800 text-white",
              )}
            >
              <Icon className="size-6" />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
