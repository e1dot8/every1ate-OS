"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Lien de la liste des salons, marqué « page courante » quand on y est. */
export function NavLink({
  href,
  className,
  children,
  label,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/discussions" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && "bg-muted font-bold text-foreground")}
    >
      {children}
    </Link>
  );
}
