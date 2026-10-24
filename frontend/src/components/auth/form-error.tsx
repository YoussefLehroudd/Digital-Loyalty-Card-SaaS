"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { Alert } from "@/components/ui/alert";

export function FormError({ message }: { message?: string | null }) {
  const { t } = useI18n();
  if (!message) {
    return null;
  }

  return <Alert className="border-red-500/30 text-red-600">{t(message)}</Alert>;
}
