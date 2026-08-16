"use client";

import { useMemo, useState, useTransition } from "react";
import { MessageCircle, Pencil, Trash2, RefreshCw } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import type { Business } from "@/types/database";
import {
  createBusinessAction,
  deleteBusinessAction,
  renewBusinessAction,
  updateBusinessAction,
  updateAdminCredentialsAction,
} from "@/lib/actions";
import { COUNTRIES, CURRENCIES, TIMEZONES } from "@/lib/validators";
import { renewalReminderWhatsAppUrl } from "@/lib/whatsapp";

type SafeBusiness = Omit<Business, "password_hash">;

export function AdminPanel({
  locale,
  dict,
  businesses,
  analytics,
}: {
  locale: Locale;
  dict: Dictionary;
  businesses: SafeBusiness[];
  analytics: {
    total: number;
    active: number;
    expired: number;
    byCountry: Record<string, number>;
  };
}) {
  const [tab, setTab] = useState<"clients" | "analytics" | "credentials">("clients");
  const [editing, setEditing] = useState<SafeBusiness | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const now = Date.now();

  const statusOf = (b: SafeBusiness) =>
    b.is_active && new Date(b.renewal_date).getTime() >= now
      ? dict.common.active
      : dict.common.expired;

  const countryEntries = useMemo(
    () => Object.entries(analytics.byCountry).sort((a, b) => b[1] - a[1]),
    [analytics.byCountry]
  );

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, successMsg?: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setMessage(dict.common.error);
      else {
        setMessage(successMsg ?? dict.common.success);
        setShowForm(false);
        setEditing(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["clients", dict.admin.clients],
            ["analytics", dict.admin.analytics],
            ["credentials", dict.auth.updateCredentials],
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
        <p className="glass rounded-xl px-4 py-3 text-sm font-medium text-[var(--navy)]">
          {message}
        </p>
      )}

      {tab === "analytics" && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [dict.admin.totalClients, analytics.total],
            [dict.admin.activeSubs, analytics.active],
            [dict.admin.expiredSubs, analytics.expired],
          ].map(([label, value]) => (
            <div key={String(label)} className="glass rounded-2xl p-5">
              <p className="text-sm text-[var(--navy-soft)]">{label}</p>
              <p className="mt-2 text-3xl font-extrabold text-[var(--navy)]">{value}</p>
            </div>
          ))}
          <div className="glass rounded-2xl p-5 sm:col-span-3">
            <h3 className="mb-4 font-bold text-[var(--navy)]">{dict.admin.byCountry}</h3>
            {countryEntries.length === 0 ? (
              <p className="text-sm text-[var(--navy-soft)]">—</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {countryEntries.map(([country, count]) => (
                  <li
                    key={country}
                    className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2 text-sm"
                  >
                    <span>{country}</span>
                    <span className="font-bold text-[var(--purple)]">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "credentials" && (
        <form
          className="glass max-w-md space-y-4 rounded-2xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => updateAdminCredentialsAction(fd), dict.admin.credentialsUpdated);
          }}
        >
          <div>
            <label className="label">{dict.auth.username}</label>
            <input name="username" className="input" required defaultValue="admin" />
          </div>
          <div>
            <label className="label">{dict.admin.adminPassword}</label>
            <input name="password" type="password" className="input" required minLength={4} />
          </div>
          <button className="btn-primary" disabled={pending}>
            {dict.common.save}
          </button>
        </form>
      )}

      {tab === "clients" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[var(--navy)]">{dict.admin.clients}</h2>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              {dict.admin.addBusiness}
            </button>
          </div>

          {(showForm || editing) && (
            <BusinessForm
              dict={dict}
              pending={pending}
              initial={editing}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
              onSubmit={(fd) => {
                if (editing) {
                  run(() => updateBusinessAction(editing.id, fd));
                } else {
                  run(() => createBusinessAction(fd));
                }
              }}
            />
          )}

          <div className="glass table-wrap rounded-2xl">
            <table className="data">
              <thead>
                <tr>
                  <th>{dict.admin.tradeName}</th>
                  <th>{dict.admin.country}</th>
                  <th>{dict.admin.renewalDate}</th>
                  <th>{dict.admin.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="font-semibold">{b.trade_name}</div>
                      <div className="text-xs text-[var(--navy-soft)]">/{b.slug}</div>
                    </td>
                    <td>{b.country}</td>
                    <td>{new Date(b.renewal_date).toLocaleDateString(locale)}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          statusOf(b) === dict.common.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {statusOf(b)}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost"
                          title={dict.common.edit}
                          onClick={() => {
                            setEditing(b);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          title={dict.admin.renew}
                          disabled={pending}
                          onClick={() =>
                            run(() => renewBusinessAction(b.id), dict.admin.renewed)
                          }
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        {b.phone && (
                          <a
                            className="btn-ghost"
                            href={renewalReminderWhatsAppUrl(
                              b.phone,
                              b.trade_name,
                              new Date(b.renewal_date).toLocaleDateString(locale),
                              locale
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={dict.admin.whatsappReminder}
                          >
                            <MessageCircle className="h-4 w-4 text-[var(--orange)]" />
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn-danger"
                          title={dict.common.delete}
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(dict.admin.deleteConfirm)) return;
                            run(() => deleteBusinessAction(b.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {businesses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--navy-soft)]">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function BusinessForm({
  dict,
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  dict: Dictionary;
  initial: SafeBusiness | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      className="glass grid gap-4 rounded-2xl p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <h3 className="sm:col-span-2 text-lg font-bold text-[var(--navy)]">
        {initial ? dict.admin.editBusiness : dict.admin.addBusiness}
      </h3>
      <Field label={dict.admin.tradeName} name="trade_name" defaultValue={initial?.trade_name} required />
      <Field
        label={dict.admin.businessType}
        name="business_type"
        defaultValue={initial?.business_type}
        required
      />
      <div>
        <label className="label">{dict.admin.country}</label>
        <select
          name="country"
          className="input"
          defaultValue={initial?.country ?? "Lebanon"}
          required
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{dict.admin.currency}</label>
        <select
          name="currency"
          className="input"
          defaultValue={initial?.currency ?? "USD"}
          required
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{dict.admin.timezone}</label>
        <select
          name="timezone"
          className="input"
          defaultValue={initial?.timezone ?? "Asia/Beirut"}
          required
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
      <Field label={dict.admin.phone} name="phone" defaultValue={initial?.phone ?? ""} />
      <Field label={dict.admin.username} name="username" defaultValue={initial?.username} required />
      <Field
        label={initial ? dict.admin.newPassword : dict.admin.password}
        name="password"
        type="password"
        required={!initial}
      />
      <Field label={dict.admin.slug} name="slug" defaultValue={initial?.slug ?? ""} />
      {initial && (
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)] sm:col-span-2">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initial.is_active}
            className="h-4 w-4"
          />
          {dict.common.active}
        </label>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {dict.common.save}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          {dict.common.cancel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="input"
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  );
}
