import { redirect, notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { BusinessDashboard } from "@/components/business-dashboard";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function businessLogout(locale: string) {
  "use server";
  await clearSessionCookie();
  redirect(`/${locale}`);
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const session = await getSession();
  if (!session || session.role !== "business" || !session.businessId) {
    redirect(`/${locale}/dashboard/login`);
  }

  const dict = getDictionary(locale);
  const supabase = createServiceClient();
  const businessId = session.businessId;

  const [{ data: business }, { data: services }, { data: appointments }, { data: settings }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("trade_name, currency, timezone, slug, phone")
        .eq("id", businessId)
        .single(),
      supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true }),
      supabase
        .from("appointments")
        .select("*, services(name)")
        .eq("business_id", businessId)
        .order("starts_at", { ascending: true }),
      supabase
        .from("business_settings")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

  if (!business) redirect(`/${locale}/dashboard/login`);

  const settingsRow = settings ?? {
    id: "",
    business_id: businessId,
    working_days: [1, 2, 3, 4, 5],
    daily_hours: { start: "09:00", end: "17:00" },
    breaks: [],
    buffer_minutes: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const logout = businessLogout.bind(null, locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} variant="app" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--navy)] sm:text-3xl">
              {dict.dashboard.title}
            </h1>
            <p className="text-[var(--navy-soft)]">{business.trade_name}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="btn-ghost">
              {dict.common.logout}
            </button>
          </form>
        </div>
        <BusinessDashboard
          locale={locale}
          dict={dict}
          currency={business.currency}
          timezone={business.timezone}
          slug={business.slug}
          phone={business.phone}
          services={services ?? []}
          appointments={(appointments ?? []) as never}
          settings={settingsRow as never}
        />
      </main>
    </>
  );
}
