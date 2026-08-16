"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import type {
  Appointment,
  BreakPeriod,
  BusinessSettings,
  DailyHours,
  Service,
} from "@/types/database";
import { createPublicBookingAction } from "@/lib/actions";
import { generateOpenSlots, formatInZone, nextDays } from "@/lib/slots";
import { formatMoney, validatePhoneForCountry, normalizePhone } from "@/lib/validators";
import { bookingConfirmationWhatsAppUrl } from "@/lib/whatsapp";
import { t } from "@/lib/i18n/get-dictionary";

type PublicBiz = {
  trade_name: string;
  country: string;
  currency: string;
  timezone: string;
  phone: string | null;
  slug: string;
};

export function BookingWizard({
  locale,
  dict,
  business,
  services,
  settings,
  appointments,
}: {
  locale: Locale;
  dict: Dictionary;
  business: PublicBiz;
  services: Service[];
  settings: Pick<
    BusinessSettings,
    "working_days" | "daily_hours" | "breaks" | "buffer_minutes"
  >;
  appointments: Pick<Appointment, "starts_at" | "ends_at" | "status">[];
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [dateIso, setDateIso] = useState(() => nextDays(1)[0].toISOString());
  const [slot, setSlot] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const service = services.find((s) => s.id === serviceId) ?? null;
  const days = useMemo(() => nextDays(21), []);

  const slots = useMemo(() => {
    if (!service) return [];
    return generateOpenSlots({
      date: new Date(dateIso),
      timeZone: business.timezone,
      workingDays: settings.working_days,
      dailyHours: settings.daily_hours as DailyHours,
      breaks: (settings.breaks as BreakPeriod[]) ?? [],
      bufferMinutes: settings.buffer_minutes,
      service,
      appointments,
    });
  }, [service, dateIso, business.timezone, settings, appointments]);

  useEffect(() => {
    setSlot(null);
  }, [serviceId, dateIso]);

  function submit() {
    setError(null);
    if (!service || !slot) return;

    const fullName = [firstName, middleName, lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
    if (!firstName.trim() || !middleName.trim() || !lastName.trim()) {
      setError(dict.booking.invalidName);
      return;
    }
    if (!validatePhoneForCountry(phone, business.country)) {
      setError(dict.booking.invalidPhone);
      return;
    }

    startTransition(async () => {
      const res = await createPublicBookingAction({
        slug: business.slug,
        serviceId: service.id,
        clientName: fullName,
        clientPhone: normalizePhone(phone),
        startsAt: slot,
      });

      if (!res.ok) {
        setError(
          res.error === "unavailable" ? dict.booking.noSlots : dict.common.error
        );
        return;
      }

      const when = formatInZone(slot, business.timezone, "yyyy-MM-dd HH:mm");
      const targetPhone = business.phone ?? phone;
      const url = bookingConfirmationWhatsAppUrl(
        targetPhone,
        fullName,
        normalizePhone(phone),
        service.name,
        when,
        locale
      );
      window.open(url, "_blank", "noopener,noreferrer");
      setError(dict.booking.success);
    });
  }

  if (services.length === 0) {
    return (
      <p className="glass rounded-2xl p-6 text-center text-[var(--navy-soft)]">
        {dict.booking.closed}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
        <Image
          src="/orbit-booking-logo.jpg"
          alt="Orbit Booking"
          width={72}
          height={72}
          className="rounded-2xl"
        />
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--navy)]">
            {business.trade_name}
          </h1>
          <p className="text-sm text-[var(--navy-soft)]">{dict.booking.title}</p>
        </div>
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 font-bold text-[var(--navy)]">{dict.booking.selectService}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const active = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                className={`rounded-2xl border p-4 text-start transition ${
                  active
                    ? "border-transparent bg-gradient-to-br from-[var(--cyan)]/30 to-[var(--purple)]/30 shadow-md"
                    : "border-white/60 bg-white/45 hover:bg-white/70"
                }`}
              >
                <div className="font-bold text-[var(--navy)]">{s.name}</div>
                <div className="mt-1 text-sm text-[var(--navy-soft)]">
                  {t(dict, "booking.minutes", { n: s.duration_minutes })} ·{" "}
                  {formatMoney(Number(s.price), business.currency, locale)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 font-bold text-[var(--navy)]">{dict.booking.selectDate}</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => {
            const iso = d.toISOString();
            const active = iso.slice(0, 10) === dateIso.slice(0, 10);
            return (
              <button
                key={iso}
                type="button"
                className={active ? "btn-primary shrink-0" : "btn-ghost shrink-0"}
                onClick={() => setDateIso(iso)}
              >
                {d.toLocaleDateString(locale === "ar" ? "ar" : "en", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 font-bold text-[var(--navy)]">{dict.booking.selectTime}</h2>
        {slots.length === 0 ? (
          <p className="text-sm text-[var(--navy-soft)]">{dict.booking.noSlots}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                className={slot === s ? "btn-primary" : "btn-ghost"}
                onClick={() => setSlot(s)}
              >
                {formatInZone(s, business.timezone, "HH:mm")}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="glass space-y-3 rounded-2xl p-5">
        <h2 className="font-bold text-[var(--navy)]">{dict.booking.yourDetails}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">{dict.booking.firstName}</label>
            <input
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">{dict.booking.middleName}</label>
            <input
              className="input"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">{dict.booking.lastName}</label>
            <input
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <label className="label">{dict.booking.phone}</label>
          <input
            className="input"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={business.country}
            required
          />
        </div>
        {error && (
          <p className="rounded-xl bg-white/70 px-3 py-2 text-sm font-medium text-[var(--navy)]">
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn-orange"
          disabled={pending || !slot || !service}
          onClick={submit}
        >
          {pending ? dict.common.loading : dict.booking.confirm}
        </button>
      </section>
    </div>
  );
}
