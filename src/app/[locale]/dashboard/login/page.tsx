import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";
import { businessLoginAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function BusinessLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const session = await getSession();
  if (session?.role === "business") redirect(`/${locale}/dashboard`);

  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} variant="app" />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
        <div className="glass rounded-3xl p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Image
              src="/orbit-booking-logo.jpg"
              alt="Orbit Booking"
              width={88}
              height={88}
              className="mb-3 rounded-2xl"
            />
            <h1 className="text-2xl font-extrabold text-[var(--navy)]">
              {dict.auth.businessTitle}
            </h1>
            <p className="mt-1 text-sm text-[var(--navy-soft)]">
              {dict.auth.businessSubtitle}
            </p>
          </div>
          <LoginForm
            dict={dict}
            action={businessLoginAction}
            redirectTo={`/${locale}/dashboard`}
          />
        </div>
      </main>
    </>
  );
}
