import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { BookingWizard } from "@/components/booking-wizard";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, trade_name, country, currency, timezone, phone, slug, is_active, renewal_date"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (
    !business ||
    !business.is_active ||
    new Date(business.renewal_date).getTime() < Date.now()
  ) {
    return (
      <>
        <SiteHeader locale={locale} dict={dict} variant="app" />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="glass rounded-2xl p-8 text-[var(--navy-soft)]">
            {dict.booking.closed}
          </p>
        </main>
      </>
    );
  }

  const [{ data: services }, { data: settings }, { data: appointments }] =
    await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("business_settings")
        .select("working_days, daily_hours, breaks, buffer_minutes")
        .eq("business_id", business.id)
        .maybeSingle(),
      supabase
        .from("appointments")
        .select("starts_at, ends_at, status")
        .eq("business_id", business.id)
        .neq("status", "canceled")
        .gte("starts_at", new Date().toISOString()),
    ]);

  const settingsSafe = settings ?? {
    working_days: [1, 2, 3, 4, 5],
    daily_hours: { start: "09:00", end: "17:00" },
    breaks: [],
    buffer_minutes: 10,
  };

  return (
    <>
      <SiteHeader locale={locale} dict={dict} variant="app" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <BookingWizard
          locale={locale}
          dict={dict}
          business={{
            trade_name: business.trade_name,
            country: business.country,
            currency: business.currency,
            timezone: business.timezone,
            phone: business.phone,
            slug: business.slug,
          }}
          services={services ?? []}
          settings={settingsSafe as never}
          appointments={appointments ?? []}
        />
      </main>
    </>
  );
}
