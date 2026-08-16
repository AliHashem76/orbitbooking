import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Clock3, MessageCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { getDictionary, t } from "@/lib/i18n/get-dictionary";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { inquiryWhatsAppUrl } from "@/lib/whatsapp";
import { notFound } from "next/navigation";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const wa = inquiryWhatsAppUrl(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} />
      <main>
        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pt-16">
          <div className="animate-fade-up">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[var(--purple)]">
              Orbit Booking
            </p>
            <h1 className="max-w-xl text-4xl font-extrabold leading-[1.12] tracking-tight text-[var(--navy)] sm:text-5xl lg:text-[3.35rem]">
              {dict.landing.heroTitle}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-[var(--navy-soft)] sm:text-lg">
              {dict.landing.heroSubtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-orange">
                <MessageCircle className="h-5 w-5" />
                {dict.landing.ctaInquire}
              </a>
              <Link href={`/${locale}/dashboard/login`} className="btn-ghost">
                {dict.landing.ctaLogin}
              </Link>
            </div>
          </div>

          <div className="relative animate-fade-up-delay">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-cyan-300/30 via-blue-400/20 to-purple-500/30 blur-2xl animate-pulse-soft" />
            <div className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
              <div className="animate-float mx-auto w-fit">
                <Image
                  src="/orbit-booking-logo.jpg"
                  alt="Orbit Booking"
                  width={320}
                  height={320}
                  className="h-auto w-56 drop-shadow-xl sm:w-72"
                  priority
                />
              </div>
              <p className="mt-4 text-center text-sm text-[var(--navy-soft)]">
                https://www.orbitbooking.online
              </p>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-extrabold text-[var(--navy)]">
              {dict.landing.featuresTitle}
            </h2>
            <p className="mt-3 text-[var(--navy-soft)]">{dict.landing.featuresSubtitle}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Clock3,
                title: dict.landing.feature1Title,
                body: dict.landing.feature1Body,
              },
              {
                icon: CalendarCheck,
                title: dict.landing.feature2Title,
                body: dict.landing.feature2Body,
              },
              {
                icon: MessageCircle,
                title: dict.landing.feature3Title,
                body: dict.landing.feature3Body,
              },
            ].map((item) => (
              <article
                key={item.title}
                className="glass rounded-2xl p-6 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-[var(--cyan)] to-[var(--purple)] p-2.5 text-white">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[var(--navy)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--navy-soft)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-white/50 py-8 text-center text-sm text-[var(--navy-soft)]">
        {t(dict, "landing.footer", { year: new Date().getFullYear() })}
      </footer>
    </>
  );
}
