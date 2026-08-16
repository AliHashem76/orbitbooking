"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { MessageCircle, Pencil, Trash2, Check } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import type {
  Appointment,
  BreakPeriod,
  BusinessSettings,
  Service,
} from "@/types/database";
import {
  cancelAppointmentAction,
  completeAppointmentAction,
  deleteServiceAction,
  upsertServiceAction,
  updateSettingsAction,
} from "@/lib/actions";
import { formatMoney } from "@/lib/validators";
import { cancellationWhatsAppUrl } from "@/lib/whatsapp";
import { formatInZone } from "@/lib/slots";

type AppointmentRow = Appointment & {
  services: { name: string } | null;
};

export function BusinessDashboard({
  locale,
  dict,
  currency,
  timezone,
  slug,
  phone,
  services,
  appointments,
  settings,
}: {
  locale: Locale;
  dict: Dictionary;
  currency: string;
  timezone: string;
  slug: string;
  phone: string | null;
  services: Service[];
  appointments: AppointmentRow[];
  settings: BusinessSettings;
}) {
  const [tab, setTab] = useState<"appointments" | "services" | "availability">(
    "appointments"
  );
  const [filter, setFilter] = useState<"upcoming" | "completed" | "canceled">(
    "upcoming"
  );
  const [editing, setEditing] = useState<Service | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () => appointments.filter((a) => a.status === filter),
    [appointments, filter]
  );

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, msg?: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setMessage(dict.common.error);
      else {
        setMessage(msg ?? dict.common.success);
        setEditing(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div>
          <p className="text-sm text-[var(--navy-soft)]">{dict.dashboard.bookingLink}</p>
          <Link
            href={`/${locale}/book/${slug}`}
            className="font-semibold text-[var(--blue)] underline-offset-2 hover:underline"
            target="_blank"
          >
            /{locale}/book/{slug}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["appointments", dict.dashboard.appointments],
            ["services", dict.dashboard.services],
            ["availability", dict.dashboard.availability],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "btn-primary" : "btn-ghost"}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <p className="glass rounded-xl px-4 py-3 text-sm font-medium">{message}</p>
      )}

      {tab === "services" && (
        <div className="space-y-4">
          <ServiceForm
            dict={dict}
            currency={currency}
            locale={locale}
            initial={editing}
            pending={pending}
            onCancel={() => setEditing(null)}
            onSubmit={(fd) => run(() => upsertServiceAction(fd))}
          />
          <div className="glass table-wrap rounded-2xl">
            <table className="data">
              <thead>
                <tr>
                  <th>{dict.dashboard.serviceName}</th>
                  <th>{dict.dashboard.duration}</th>
                  <th>{dict.dashboard.price}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.name}</td>
                    <td>{s.duration_minutes}</td>
                    <td>{formatMoney(Number(s.price), currency, locale)}</td>
                    <td>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => setEditing(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(dict.common.confirm)) return;
                            run(() => deleteServiceAction(s.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "appointments" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["upcoming", dict.dashboard.upcoming],
                ["completed", dict.dashboard.completed],
                ["canceled", dict.dashboard.canceled],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={filter === key ? "btn-primary" : "btn-ghost"}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="glass table-wrap rounded-2xl">
            <table className="data">
              <thead>
                <tr>
                  <th>{dict.dashboard.clientName}</th>
                  <th>{dict.dashboard.clientPhone}</th>
                  <th>{dict.dashboard.serviceName}</th>
                  <th>{dict.dashboard.when}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="font-semibold">{a.client_name}</td>
                    <td dir="ltr">{a.client_phone}</td>
                    <td>{a.services?.name ?? "—"}</td>
                    <td>{formatInZone(a.starts_at, timezone, "MMM d, HH:mm")}</td>
                    <td>
                      {a.status === "upcoming" && (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            className="btn-ghost"
                            disabled={pending}
                            onClick={() => run(() => completeAppointmentAction(a.id))}
                            title={dict.dashboard.markCompleted}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            disabled={pending}
                            onClick={() => {
                              if (!confirm(dict.dashboard.cancelConfirm)) return;
                              startTransition(async () => {
                                const res = await cancelAppointmentAction(a.id);
                                if (res.error || !res.ok) {
                                  setMessage(dict.common.error);
                                  return;
                                }
                                const when = formatInZone(
                                  a.starts_at,
                                  timezone,
                                  "yyyy-MM-dd HH:mm"
                                );
                                const url = cancellationWhatsAppUrl(
                                  a.client_phone,
                                  a.client_name,
                                  a.services?.name ?? "",
                                  when,
                                  locale
                                );
                                window.open(url, "_blank", "noopener,noreferrer");
                                setMessage(dict.common.success);
                              });
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">
                              {dict.dashboard.cancelAppointment}
                            </span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--navy-soft)]">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!phone && (
            <p className="text-sm text-[var(--orange)]">{dict.dashboard.noPhone}</p>
          )}
        </div>
      )}

      {tab === "availability" && (
        <AvailabilityForm
          dict={dict}
          settings={settings}
          pending={pending}
          onSubmit={(fd) => run(() => updateSettingsAction(fd))}
        />
      )}
    </div>
  );
}

function ServiceForm({
  dict,
  currency,
  locale,
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  dict: Dictionary;
  currency: string;
  locale: Locale;
  initial: Service | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <div className="sm:col-span-2">
        <label className="label">{dict.dashboard.serviceName}</label>
        <input
          name="name"
          className="input"
          required
          defaultValue={initial?.name ?? ""}
          key={initial?.id ?? "new"}
        />
      </div>
      <div>
        <label className="label">{dict.dashboard.duration}</label>
        <input
          name="duration_minutes"
          type="number"
          min={5}
          max={480}
          className="input"
          required
          defaultValue={initial?.duration_minutes ?? 30}
        />
      </div>
      <div>
        <label className="label">
          {dict.dashboard.price} ({currency})
        </label>
        <input
          name="price"
          type="number"
          min={0}
          step="0.01"
          className="input"
          required
          defaultValue={initial ? Number(initial.price) : 0}
        />
      </div>
      <div className="flex gap-2 sm:col-span-4">
        <button type="submit" className="btn-primary" disabled={pending}>
          {initial ? dict.common.save : dict.dashboard.addService}
        </button>
        {initial && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {dict.common.cancel}
          </button>
        )}
        <span className="self-center text-xs text-[var(--navy-soft)]">
          {locale === "ar" ? "مثال" : "e.g."}{" "}
          {formatMoney(50, currency, locale)}
        </span>
      </div>
    </form>
  );
}

function AvailabilityForm({
  dict,
  settings,
  pending,
  onSubmit,
}: {
  dict: Dictionary;
  settings: BusinessSettings;
  pending: boolean;
  onSubmit: (fd: FormData) => void;
}) {
  const [days, setDays] = useState<number[]>(settings.working_days ?? [1, 2, 3, 4, 5]);
  const [breaks, setBreaks] = useState<BreakPeriod[]>(
    (settings.breaks as BreakPeriod[]) ?? []
  );
  const hours = settings.daily_hours ?? { start: "09:00", end: "17:00" };

  return (
    <form
      className="glass space-y-5 rounded-2xl p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("working_days", JSON.stringify(days));
        fd.set("breaks", JSON.stringify(breaks));
        onSubmit(fd);
      }}
    >
      <div>
        <p className="label">{dict.dashboard.workingDays}</p>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const active = days.includes(d);
            const label = dict.dashboard[`day${d}` as keyof typeof dict.dashboard];
            return (
              <button
                key={d}
                type="button"
                className={active ? "btn-primary" : "btn-ghost"}
                onClick={() =>
                  setDays((prev) =>
                    prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
                  )
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">{dict.dashboard.hoursStart}</label>
          <input
            name="hours_start"
            type="time"
            className="input"
            defaultValue={hours.start}
            required
          />
        </div>
        <div>
          <label className="label">{dict.dashboard.hoursEnd}</label>
          <input
            name="hours_end"
            type="time"
            className="input"
            defaultValue={hours.end}
            required
          />
        </div>
        <div>
          <label className="label">{dict.dashboard.buffer}</label>
          <input
            name="buffer_minutes"
            type="number"
            min={0}
            max={120}
            className="input"
            defaultValue={settings.buffer_minutes ?? 10}
            required
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="label mb-0">{dict.dashboard.breaks}</p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              setBreaks((prev) => [...prev, { start: "12:00", end: "13:00", label: "Break" }])
            }
          >
            {dict.dashboard.addBreak}
          </button>
        </div>
        <div className="space-y-2">
          {breaks.map((b, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-white/50 p-3 sm:grid-cols-4">
              <input
                className="input"
                type="time"
                value={b.start}
                onChange={(e) =>
                  setBreaks((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, start: e.target.value } : x))
                  )
                }
              />
              <input
                className="input"
                type="time"
                value={b.end}
                onChange={(e) =>
                  setBreaks((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, end: e.target.value } : x))
                  )
                }
              />
              <input
                className="input"
                placeholder={dict.dashboard.breakLabel}
                value={b.label ?? ""}
                onChange={(e) =>
                  setBreaks((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x))
                  )
                }
              />
              <button
                type="button"
                className="btn-danger"
                onClick={() => setBreaks((prev) => prev.filter((_, idx) => idx !== i))}
              >
                {dict.common.delete}
              </button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={pending}>
        {dict.common.save}
      </button>
    </form>
  );
}
