import { notFound } from "next/navigation";
import { getDirection, isLocale, type Locale } from "@/lib/i18n/config";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dir = getDirection(locale);

  return (
    <div lang={locale} dir={dir} className="min-h-screen">
      {children}
    </div>
  );
}
