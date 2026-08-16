import { redirect, notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AdminPanel } from "@/components/admin-panel";
import { getAdminAnalytics } from "@/lib/actions";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function adminLogout(locale: string) {
  "use server";
  await clearSessionCookie();
  redirect(`/${locale}`);
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect(`/${locale}/admin/login`);
  }

  const dict = getDictionary(locale);
  const supabase = createServiceClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select(
      "id, trade_name, business_type, country, currency, timezone, username, phone, slug, subscription_date, renewal_date, is_active, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  const analytics = await getAdminAnalytics();
  const logout = adminLogout.bind(null, locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} variant="app" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-[var(--navy)] sm:text-3xl">
            {dict.admin.dashboard}
          </h1>
          <form action={logout}>
            <button type="submit" className="btn-ghost">
              {dict.common.logout}
            </button>
          </form>
        </div>
        <AdminPanel
          locale={locale}
          dict={dict}
          businesses={(businesses ?? []) as never}
          analytics={analytics}
        />
      </main>
    </>
  );
}
