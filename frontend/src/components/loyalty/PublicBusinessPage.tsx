"use client";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useState } from "react";
import { Building2, Gift } from "lucide-react";
import { PublicCustomerRegisterForm } from "@/components/loyalty/PublicCustomerRegisterForm";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { getPublicBusinessBySlug, type PublicBusinessLookupResponse } from "@/lib/public";
export function PublicBusinessPage({ businessSlug }: {
    businessSlug: string;
}) {
    const { t: tr } = useI18n();
    const [data, setData] = useState<PublicBusinessLookupResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let mounted = true;
        async function load(silent = false) {
            if (!silent) {
                setIsLoading(true);
                setError(null);
                setNotFound(false);
            }
            try {
                const response = await getPublicBusinessBySlug(businessSlug);
                if (!mounted)
                    return;
                setData(response);
            }
            catch (unknownError) {
                if (!mounted || silent)
                    return;
                if (unknownError instanceof ApiError && unknownError.status === 404) {
                    setNotFound(true);
                    setData(null);
                    return;
                }
                setError("Unable to load this loyalty page right now.");
                setData(null);
            }
            finally {
                if (mounted)
                    setIsLoading(false);
            }
        }
        let timer: number | undefined;
        const poll = async (initial = false) => {
            if (!mounted)
                return;
            if (initial || document.visibilityState === "visible")
                await load(!initial);
            if (mounted)
                timer = window.setTimeout(poll, 1500);
        };
        void poll(true);
        return () => {
            mounted = false;
            if (timer !== undefined)
                window.clearTimeout(timer);
        };
    }, [businessSlug]);
    if (isLoading) {
        return <PublicBusinessPageSkeleton />;
    }
    if (notFound) {
        return (<main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8"><div className="relative z-40 mb-4 flex justify-end"><LanguageSwitcher /></div>
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>{tr("Business not found")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{tr(" This loyalty page does not exist or is no longer available. ")}</p>
            </CardContent>
          </Card>
        </div>
      </main>);
    }
    if (error || !data) {
        return (<main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8"><div className="relative z-40 mb-4 flex justify-end"><LanguageSwitcher /></div>
        <div className="mx-auto max-w-3xl space-y-4">
          <Alert className="border-red-500/30 text-red-600">
            {error ?? tr("Unexpected error while loading this page.")}
          </Alert>
        </div>
      </main>);
    }
    const { business, loyalty_card } = data;
    return (<main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8"><div className="relative z-40 mb-4 flex justify-end"><LanguageSwitcher /></div>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {business.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={tr("{0} logo", { "0": business.name })} className="size-full object-cover" src={business.logo_url}/>) : (<Building2 className="size-6 text-muted-foreground"/>)}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold">
                  {business.name}
                </h1>
                <p className="truncate text-sm text-muted-foreground">
                  {business.email}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg border p-4 text-white" style={{ backgroundColor: business.primary_color || "#171717" }}>
              {business.hero_image_url ? (<div className="absolute inset-0" style={{
                overflow: "hidden",
            }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={business.hero_image_url} alt={tr("{0} hero background", { "0": business.name })} className="absolute inset-0 h-full w-full select-none" style={{
                objectFit: "cover",
                transform: `scale(${business.hero_image_zoom ?? 1})`,
                transformOrigin: "center",
                objectPosition: `${(business.hero_image_position_x ?? 0) + 50}% ${(business.hero_image_position_y ?? 0) + 50}%`,
                zIndex: 0,
            }}/>
                  </div>) : null}

                <div className="absolute inset-0" style={{
            background: business.hero_image_url
                ? "linear-gradient(90deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))"
                : "transparent",
            zIndex: 1,
        }}/>

                <div className="relative z-[2]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{tr("Digital loyalty card")}</p>
                    <Badge className="bg-white/15 text-white">
                      <Gift className="size-4"/>{tr(" Reward ")}</Badge>
                  </div>

                  {loyalty_card ? (<div className="mt-4 space-y-2">
                      <p className="text-lg font-semibold">
                        {loyalty_card.reward_name}
                      </p>
                      <p className="text-sm opacity-90">
                        {loyalty_card.required_stamps}{tr(" stamps required ")}</p>
                      <p className="text-sm opacity-80">
                        {loyalty_card.reward_description ?? tr("No description provided.")}
                      </p>
                      <div className="mt-3 grid grid-cols-5 grid-rows-2 gap-2" style={{ aspectRatio: "5 / 2" }}>
                        {Array.from({
                length: Math.max(1, Math.floor(loyalty_card.required_stamps)),
            }).map((_, idx) => (<div key={idx} className="h-full min-h-0 rounded-md border border-white/20 bg-white/10"/>))}
                      </div>
                    </div>) : (<p className="mt-4 text-sm opacity-90">{tr(" Loyalty card details will be available soon. ")}</p>)}
                </div>
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr("Join loyalty program")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PublicCustomerRegisterForm businessSlug={businessSlug}/>
          </CardContent>
        </Card>
      </div>
    </main>);
}
function PublicBusinessPageSkeleton() {
    const { t: tr } = useI18n();
    return (<main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8"><div className="relative z-40 mb-4 flex justify-end"><LanguageSwitcher /></div>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-lg"/>
              <div className="space-y-2">
                <Skeleton className="h-6 w-52"/>
                <Skeleton className="h-4 w-40"/>
              </div>
            </div>
            <Skeleton className="h-64 w-full"/>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton aria-hidden="true" className="h-5 w-2/3"/>
            <Skeleton className="h-12 w-full"/>
            <Skeleton className="h-12 w-full"/>
            <Skeleton className="h-12 w-full"/>
            <Skeleton className="h-12 w-full"/>
            <Skeleton className="h-10 w-full"/>
          </CardContent>
        </Card>
      </div>
    </main>);
}
