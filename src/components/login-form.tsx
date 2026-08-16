"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Action = (formData: FormData) => Promise<{ error?: string; ok?: boolean }>;

export function LoginForm({
  dict,
  action,
  redirectTo,
}: {
  dict: Dictionary;
  action: Action;
  redirectTo: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const res = await action(fd);
          if (res?.error) {
            setError(dict.auth.invalid);
            return;
          }
          router.push(redirectTo);
          router.refresh();
        });
      }}
    >
      <div>
        <label className="label" htmlFor="username">
          {dict.auth.username}
        </label>
        <input
          id="username"
          name="username"
          className="input"
          autoComplete="username"
          required
          maxLength={64}
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {dict.auth.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </div>
      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? dict.common.loading : dict.auth.signIn}
      </button>
    </form>
  );
}
