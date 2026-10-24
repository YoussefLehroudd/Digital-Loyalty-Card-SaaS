"use client";

import { useI18n } from "@/components/i18n/language-provider";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  inputClassName?: string;
};

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, inputClassName, ...props }, ref) => {
    const { t } = useI18n();
    const [visible, setVisible] = React.useState(false);

    return (
      <div className={cn("relative", className)}>
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pe-10", inputClassName)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground focus-visible:outline-none"
          aria-label={visible ? t("Hide password") : t("Show password")}
          title={visible ? t("Hide password") : t("Show password")}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
