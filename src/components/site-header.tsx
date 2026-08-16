import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

export function SiteHeader({
  locale,
  dict,
  variant = "marketing",
}: {
  locale: Locale;
  dict: Dictionary;
  variant?: "marketing" | "app";
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/35 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-3">
          <Image
            src="/orbit-booking-logo.jpg"
            alt="Orbit Booking"
            width={52}
            height={52}
            className="h-11 w-11 rounded-xl object-contain sm:h-12 sm:w-12"
            priority
          />
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-tight text-[var(--navy)] sm:text-xl">
              {dict.brand.name}
            </div>
            <div className="text-xs font-medium text-[var(--navy-soft)] opacity-80">
              {dict.brand.tagline}
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {variant === "marketing" && (
            <>
              <Link
                href={`/${locale}/dashboard/login`}
                className="hidden rounded-xl px-3 py-1.5 text-sm font-semibold text-[var(--navy)] sm:inline"
              >
                {dict.nav.login}
              </Link>
              {/*<Link
                href={`/${locale}/admin/login`}
                className="hidden rounded-xl px-3 py-1.5 text-sm font-medium text-[var(--navy-soft)] sm:inline"
              >
                {dict.nav.admin}
              </Link>*/}
            </>
          )}
          <LanguageSwitcher locale={locale} />
        </nav>
      </div>
    </header>
  );
}
