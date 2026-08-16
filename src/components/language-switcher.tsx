"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const other: Locale = locale === "en" ? "ar" : "en";
  const segments = pathname.split("/");
  segments[1] = other;
  const href = segments.join("/") || `/${other}`;

  return (
    <Link
      href={href}
      className="rounded-xl border border-white/40 bg-white/50 px-3 py-1.5 text-sm font-medium text-[var(--navy)] backdrop-blur transition hover:bg-white/80"
      hrefLang={other}
    >
      {locale === "en" ? "العربية" : "English"}
    </Link>
  );
}
