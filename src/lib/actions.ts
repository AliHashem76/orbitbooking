"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  hashPassword,
  requireAdmin,
  requireBusiness,
  setSessionCookie,
  verifyPassword,
  getSession,
} from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/validators";
import { z } from "zod";

function addOneMonth(date = new Date()): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export async function adminLoginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid" };

  const supabase = createServiceClient();
  const { data: admin } = await supabase
    .from("admins")
    .select("id, username, password_hash")
    .eq("username", parsed.data.username)
    .maybeSingle();

  if (!admin || !(await verifyPassword(parsed.data.password, admin.password_hash))) {
    return { error: "invalid" };
  }

  await setSessionCookie({
    sub: admin.id,
    role: "admin",
    username: admin.username,
  });

  return { ok: true };
}

export async function businessLoginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid" };

  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, username, password_hash, is_active, renewal_date")
    .eq("username", parsed.data.username)
    .maybeSingle();

  if (
    !business ||
    !business.is_active ||
    !(await verifyPassword(parsed.data.password, business.password_hash))
  ) {
    return { error: "invalid" };
  }

  await setSessionCookie({
    sub: business.id,
    role: "business",
    username: business.username,
    businessId: business.id,
  });

  return { ok: true };
}

export async function logoutAction(locale: string) {
  await clearSessionCookie();
  redirect(`/${locale}`);
}

export async function updateAdminCredentialsAction(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || password.length < 4) return { error: "invalid" };

  const session = await getSession();
  const supabase = createServiceClient();
  const password_hash = await hashPassword(password);
  const { error } = await supabase
    .from("admins")
    .update({ username, password_hash })
    .eq("id", session!.sub);

  if (error) return { error: "failed" };

  await setSessionCookie({
    sub: session!.sub,
    role: "admin",
    username,
  });
  return { ok: true };
}

const businessSchema = z.object({
  trade_name: z.string().trim().min(2).max(120),
  business_type: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  currency: z.string().trim().min(3).max(3),
  timezone: z.string().trim().min(2).max(64),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  username: z.string().trim().min(3).max(64),
  password: z.string().min(4).max(128).optional().or(z.literal("")),
  slug: z.string().trim().max(60).optional().or(z.literal("")),
  is_active: z.boolean().optional(),
});

export async function createBusinessAction(formData: FormData) {
  await requireAdmin();
  const parsed = businessSchema.safeParse({
    trade_name: formData.get("trade_name"),
    business_type: formData.get("business_type"),
    country: formData.get("country"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    phone: formData.get("phone") ?? "",
    username: formData.get("username"),
    password: formData.get("password"),
    slug: formData.get("slug") ?? "",
  });

  if (!parsed.success || !parsed.data.password) {
    return { error: "invalid" };
  }

  const slug = parsed.data.slug
    ? slugify(parsed.data.slug)
    : slugify(parsed.data.trade_name);
  if (!slug) return { error: "invalid" };

  const now = new Date();
  const supabase = createServiceClient();
  const { error } = await supabase.from("businesses").insert({
    trade_name: parsed.data.trade_name,
    business_type: parsed.data.business_type,
    country: parsed.data.country,
    currency: parsed.data.currency,
    timezone: parsed.data.timezone,
    phone: parsed.data.phone || null,
    username: parsed.data.username,
    password_hash: await hashPassword(parsed.data.password),
    slug,
    subscription_date: now.toISOString(),
    renewal_date: addOneMonth(now).toISOString(),
    is_active: true,
  });

  if (error) {
    return { error: error.message.includes("duplicate") ? "duplicate" : "failed" };
  }

  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

export async function updateBusinessAction(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = businessSchema.safeParse({
    trade_name: formData.get("trade_name"),
    business_type: formData.get("business_type"),
    country: formData.get("country"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    phone: formData.get("phone") ?? "",
    username: formData.get("username"),
    password: formData.get("password") ?? "",
    slug: formData.get("slug") ?? "",
    is_active: formData.get("is_active") === "on" || formData.get("is_active") === "true",
  });
  if (!parsed.success) return { error: "invalid" };

  const slug = parsed.data.slug
    ? slugify(parsed.data.slug)
    : slugify(parsed.data.trade_name);

  const updates: Record<string, unknown> = {
    trade_name: parsed.data.trade_name,
    business_type: parsed.data.business_type,
    country: parsed.data.country,
    currency: parsed.data.currency,
    timezone: parsed.data.timezone,
    phone: parsed.data.phone || null,
    username: parsed.data.username,
    slug,
    is_active: parsed.data.is_active ?? true,
  };

  if (parsed.data.password && parsed.data.password.length >= 4) {
    updates.password_hash = await hashPassword(parsed.data.password);
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("businesses").update(updates).eq("id", id);
  if (error) return { error: "failed" };

  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

export async function deleteBusinessAction(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("businesses").delete().eq("id", id);
  if (error) return { error: "failed" };
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

export async function renewBusinessAction(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("renew_business_subscription", {
    p_business_id: id,
  });
  if (error) return { error: "failed" };
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true, renewal_date: data as string };
}

export async function getAdminAnalytics() {
  await requireAdmin();
  const supabase = createServiceClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, country, renewal_date, is_active");

  const list = businesses ?? [];
  const now = Date.now();
  const active = list.filter((b) => b.is_active && new Date(b.renewal_date).getTime() >= now);
  const expired = list.filter((b) => !b.is_active || new Date(b.renewal_date).getTime() < now);
  const byCountry: Record<string, number> = {};
  for (const b of list) {
    byCountry[b.country] = (byCountry[b.country] ?? 0) + 1;
  }

  return {
    total: list.length,
    active: active.length,
    expired: expired.length,
    byCountry,
  };
}

/* -------------------- Business dashboard -------------------- */

export async function upsertServiceAction(formData: FormData) {
  const session = await requireBusiness();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const duration = Number(formData.get("duration_minutes"));
  const price = Number(formData.get("price"));

  if (!name || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(price) || price < 0) {
    return { error: "invalid" };
  }

  const supabase = createServiceClient();
  if (id) {
    const { error } = await supabase
      .from("services")
      .update({ name, duration_minutes: duration, price })
      .eq("id", id)
      .eq("business_id", session.businessId!);
    if (error) return { error: "failed" };
  } else {
    const { error } = await supabase.from("services").insert({
      business_id: session.businessId!,
      name,
      duration_minutes: duration,
      price,
      is_active: true,
    });
    if (error) return { error: "failed" };
  }

  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true };
}

export async function deleteServiceAction(id: string) {
  const session = await requireBusiness();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("business_id", session.businessId!);
  if (error) return { error: "failed" };
  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true };
}

export async function updateSettingsAction(formData: FormData) {
  const session = await requireBusiness();
  const workingDaysRaw = String(formData.get("working_days") ?? "[]");
  const breaksRaw = String(formData.get("breaks") ?? "[]");
  const start = String(formData.get("hours_start") ?? "09:00");
  const end = String(formData.get("hours_end") ?? "17:00");
  const buffer = Number(formData.get("buffer_minutes") ?? 10);

  let working_days: number[] = [];
  let breaks: unknown[] = [];
  try {
    working_days = JSON.parse(workingDaysRaw);
    breaks = JSON.parse(breaksRaw);
  } catch {
    return { error: "invalid" };
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("business_settings")
    .update({
      working_days,
      daily_hours: { start, end },
      breaks,
      buffer_minutes: Number.isFinite(buffer) ? buffer : 10,
    })
    .eq("business_id", session.businessId!);

  if (error) return { error: "failed" };
  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true };
}

export async function cancelAppointmentAction(id: string) {
  const session = await requireBusiness();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("business_id", session.businessId!)
    .select("*, services(name)")
    .maybeSingle();

  if (error || !data) return { error: "failed" };
  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true, appointment: data };
}

export async function completeAppointmentAction(id: string) {
  const session = await requireBusiness();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", id)
    .eq("business_id", session.businessId!);
  if (error) return { error: "failed" };
  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true };
}

export async function createPublicBookingAction(input: {
  slug: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  startsAt: string;
}) {
  const schema = z.object({
    slug: z.string().min(1).max(60),
    serviceId: z.string().uuid(),
    clientName: z.string().trim().min(3).max(120),
    clientPhone: z.string().trim().min(8).max(32),
    startsAt: z.string().min(1),
  });

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("create_public_appointment", {
    p_business_slug: parsed.data.slug,
    p_service_id: parsed.data.serviceId,
    p_client_name: parsed.data.clientName,
    p_client_phone: parsed.data.clientPhone,
    p_starts_at: parsed.data.startsAt,
  });

  if (error) {
    return { error: error.message.includes("unavailable") ? "unavailable" : "failed" };
  }

  return { ok: true, appointmentId: data as string };
}
