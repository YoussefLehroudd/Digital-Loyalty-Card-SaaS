import { Globe2 } from "lucide-react";

export function CountryFlag({ code, className = "" }: { code: string | null | undefined; className?: string }) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return <span className={`inline-flex h-[16px] w-[23px] shrink-0 items-center justify-center text-white/45 ${className}`} title="Unknown country">
      <Globe2 className="size-4" aria-label="Country unknown"/>
    </span>;
  }
  return <span
    role="img"
    aria-label={`Flag: ${normalized}`}
    title={normalized}
    className={`inline-flex h-[16px] w-[23px] shrink-0 overflow-hidden rounded-[2px] border border-white/20 align-middle shadow-sm ${className}`}
  >
    <span
      aria-hidden="true"
      className={`fi fi-${normalized.toLowerCase()}`}
      style={{display:"block",width:"100%",height:"100%",backgroundSize:"cover"}}
    />
  </span>;
}
