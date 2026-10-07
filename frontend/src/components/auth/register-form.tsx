"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, CheckCircle2, Loader2, MailCheck, RotateCcw, UserRound, XCircle } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";

import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { registerBusinessOwner, storeToken, verifyBusinessEmail } from "@/lib/auth";
import { customerRegister, storeCustomerToken } from "@/lib/customerAuth";

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.");

const baseSchema = z.object({
    businessName: z.string().min(2, "Enter your business name."),
    businessEmail: z.string().email("Enter a valid business email."),
    name: z.string().min(2, "Enter your name."),
    email: z.string().email("Enter a valid owner email."),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  });
const schema = baseSchema.refine((values) => values.password === values.passwordConfirmation, {
    message: "Passwords do not match.",
    path: ["passwordConfirmation"],
  });

type RegisterValues = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"customer" | "business">("customer");
  const [error, setError] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(accountType === "customer" ? baseSchema.extend({ businessName: z.string(), businessEmail: z.string() }).refine(values => values.password === values.passwordConfirmation, { message: "Passwords do not match.", path: ["passwordConfirmation"] }) : schema),
    defaultValues: {
      businessName: "",
      businessEmail: "",
      name: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setError(null);

    try {
      if (accountType === "customer") {
        const nameParts = values.name.trim().split(/\s+/);
        const firstName = nameParts.shift() || values.name.trim();
        const lastName = nameParts.join(" ") || "-";
        const response = await customerRegister({
          first_name: firstName,
          last_name: lastName,
          email: values.email,
          password: values.password,
          password_confirmation: values.passwordConfirmation,
          device_name: "web-unified-register",
        });
        storeCustomerToken(response.token);
        const query = new URLSearchParams(window.location.search);
        const join = query.get("join");
        const businessId = query.get("join_business_id");
        router.replace(join ? `/user/join?auto=${encodeURIComponent(join)}` : businessId ? `/user/join?auto_business_id=${encodeURIComponent(businessId)}` : "/user/dashboard");
        router.refresh();
        return;
      }

      const response = await registerBusinessOwner({
        business_name: values.businessName,
        business_email: values.businessEmail,
        name: values.name,
        email: values.email,
        password: values.password,
        password_confirmation: values.passwordConfirmation,
      });
      setOtpEmail(response.email);
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(
          unknownError.errors?.email?.[0] ??
            unknownError.errors?.business_email?.[0] ??
            unknownError.message,
        );
        return;
      }

      setError("Unable to create your workspace. Try again.");
    }
  }

  if (otpEmail) {
    return <BusinessOtpVerification email={otpEmail} onBack={() => { setOtpEmail(null); setError(null); }} />;
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        <button type="button" onClick={() => setAccountType("customer")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${accountType === "customer" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><UserRound className="size-4" />Customer</button>
        <button type="button" onClick={() => setAccountType("business")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${accountType === "business" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Building2 className="size-4" />Business</button>
      </div>
      {accountType === "business" ? <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors.businessName?.message}
          label="Business name"
          registration={register("businessName")}
        />
        <Field
          error={errors.businessEmail?.message}
          label="Business email"
          registration={register("businessEmail")}
          type="email"
        />
      </div> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors.name?.message}
          label={accountType === "business" ? "Owner name" : "Full name"}
          registration={register("name")}
        />
        <Field
          error={errors.email?.message}
          label={accountType === "business" ? "Owner email" : "Email"}
          registration={register("email")}
          type="email"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors.password?.message}
          label="Password"
          registration={register("password")}
          type="password"
        />
        <Field
          error={errors.passwordConfirmation?.message}
          label="Confirm password"
          registration={register("passwordConfirmation")}
          type="password"
        />
      </div>
      <Button className="w-full border-0 bg-[#efbd5d] font-semibold text-black shadow-[0_10px_30px_rgba(239,189,93,.16)] hover:bg-[#f4c86f]" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating account..." : accountType === "business" ? "Create business account" : "Create customer account"}
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  type?: string;
  registration: UseFormRegisterReturn;
};

function Field({ label, error, type = "text", registration }: FieldProps) {
  const id = registration.name;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {type === "password" ? (
        <PasswordInput id={id} {...registration} />
      ) : (
        <Input id={id} type={type} {...registration} />
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}


function BusinessOtpVerification({ email, onBack }: { email: string; onBack: () => void }) {
  const router = useRouter();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  const code = digits.join("");

  const updateDigit = (index: number, raw: string) => {
    if (status === "verifying" || status === "success") return;
    const value = raw.replace(/\D/g, "").slice(-1);
    setStatus("idle");
    setMessage(null);
    setDigits((current) => current.map((digit, i) => (i === index ? value : digit)));
    if (value && index < 5) refs.current[index + 1]?.focus();
  };

  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!value) return;
    event.preventDefault();
    setDigits(Array.from({ length: 6 }, (_, i) => value[i] ?? ""));
    refs.current[Math.min(value.length, 6) - 1]?.focus();
  };

  const verify = async () => {
    if (code.length !== 6 || status === "verifying") return;
    setStatus("verifying");
    setMessage(null);
    try {
      const response = await verifyBusinessEmail({ email, code });
      setStatus("success");
      storeToken(response.token);
      window.setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 1150);
    } catch (unknownError) {
      setStatus("error");
      setMessage(unknownError instanceof ApiError ? unknownError.message : "Verification failed. Try again.");
      window.setTimeout(() => setStatus((value) => (value === "error" ? "idle" : value)), 1300);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-[#efbd5d]/25 bg-[#efbd5d]/10 text-[#f4c45e] shadow-[0_0_35px_rgba(239,189,93,.1)]">
          <MailCheck className="size-6" />
        </div>
        <h3 className="text-xl font-bold text-white">Verify your business email</h3>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">We sent a 6-digit code to <span className="font-medium text-white">{email}</span></p>
      </div>

      <div className="relative py-2">
        {status === "success" ? (
          <div className="animate-in zoom-in-75 fade-in flex h-[74px] items-center justify-center gap-3 rounded-2xl border border-emerald-400/60 bg-emerald-500/10 text-emerald-300 shadow-[0_0_35px_rgba(52,211,153,.14)] duration-500">
            <CheckCircle2 className="size-7" />
            <div><div className="font-bold">Email verified</div><div className="text-xs text-emerald-200/70">Opening your workspace...</div></div>
          </div>
        ) : (
          <div className={`grid grid-cols-6 gap-2 transition-all duration-500 ${status === "error" ? "animate-[shake_.35s_ease-in-out]" : ""}`}>
            {digits.map((digit, index) => (
              <div key={index} className={`relative overflow-hidden rounded-xl p-px transition-all duration-300 ${status === "verifying" ? "bg-[conic-gradient(from_var(--angle),#ef4444,#f59e0b,#ef4444)] animate-[spin_1.2s_linear_infinite]" : status === "error" ? "bg-red-500 shadow-[0_0_18px_rgba(239,68,68,.22)]" : "bg-white/15 focus-within:bg-[#efbd5d]"}`}>
                <input
                  ref={(node) => { refs.current[index] = node; }}
                  value={digit}
                  onChange={(event) => updateDigit(index, event.target.value)}
                  onPaste={onPaste}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
                    if (event.key === "Enter") void verify();
                  }}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  aria-label={`Verification digit ${index + 1}`}
                  className="h-[62px] w-full rounded-[11px] bg-[#11120f] text-center text-2xl font-bold text-white outline-none transition sm:h-[70px] sm:text-3xl"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {message ? <div className="flex items-center justify-center gap-2 text-sm text-red-400"><XCircle className="size-4" />{message}</div> : null}

      <Button type="button" onClick={() => void verify()} disabled={code.length !== 6 || status === "verifying" || status === "success"} className="h-12 w-full border-0 bg-[#efbd5d] font-semibold text-black hover:bg-[#f4c86f]">
        {status === "verifying" ? <><Loader2 className="size-4 animate-spin" />Verifying...</> : "Verify code"}
      </Button>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <button type="button" onClick={onBack} className="transition hover:text-white">Change email</button>
        <button type="button" disabled={seconds > 0} onClick={() => { setSeconds(60); onBack(); }} className="inline-flex items-center gap-1.5 transition enabled:text-[#efbd5d] disabled:opacity-50">
          <RotateCcw className="size-3.5" />{seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
