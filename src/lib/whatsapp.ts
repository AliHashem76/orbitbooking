import type { Locale } from "@/lib/i18n/config";

const INQUIRY_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "96170985130";

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = digitsOnly(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function inquiryWhatsAppUrl(locale: Locale): string {
  const message =
    locale === "ar"
      ? "مرحباً، أود الاستفسار عن خدمة Orbit Booking لحجز المواعيد لنشاطي التجاري."
      : "Hello, I would like to inquire about Orbit Booking appointment services for my business.";
  return buildWhatsAppUrl(INQUIRY_NUMBER, message);
}

export function renewalReminderWhatsAppUrl(
  clientPhone: string,
  tradeName: string,
  renewalDate: string,
  locale: Locale
): string {
  const message =
    locale === "ar"
      ? `مرحباً ${tradeName}، تذكير ودي بأن اشتراككم في Orbit Booking يستحق التجديد بتاريخ ${renewalDate}. يرجى التواصل معنا لتجديد الاشتراك.`
      : `Hello ${tradeName}, this is a friendly reminder that your Orbit Booking subscription renews on ${renewalDate}. Please contact us to renew.`;
  return buildWhatsAppUrl(clientPhone, message);
}

export function cancellationWhatsAppUrl(
  clientPhone: string,
  clientName: string,
  serviceName: string,
  when: string,
  locale: Locale
): string {
  const message =
    locale === "ar"
      ? `مرحباً ${clientName}، نعتذر لإبلاغكم بأنه تم إلغاء موعدكم لخدمة "${serviceName}" بتاريخ ${when}. نأمل التواصل معنا لإعادة الجدولة.`
      : `Hello ${clientName}, we regret to inform you that your appointment for "${serviceName}" on ${when} has been canceled. Please contact us to reschedule.`;
  return buildWhatsAppUrl(clientPhone, message);
}

export function bookingConfirmationWhatsAppUrl(
  businessPhone: string,
  clientName: string,
  clientPhone: string,
  serviceName: string,
  when: string,
  locale: Locale
): string {
  const message =
    locale === "ar"
      ? `تأكيد حجز جديد عبر Orbit Booking:\nالعميل: ${clientName}\nالهاتف: ${clientPhone}\nالخدمة: ${serviceName}\nالموعد: ${when}`
      : `New booking via Orbit Booking:\nCustomer: ${clientName}\nPhone: ${clientPhone}\nService: ${serviceName}\nTime: ${when}`;
  return buildWhatsAppUrl(businessPhone, message);
}
