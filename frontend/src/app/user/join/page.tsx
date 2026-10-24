"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerPageSkeleton } from "@/components/customer-app/customer-skeletons";
import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { StaffQrScanner } from "@/components/scanner/StaffQrScanner";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerCards, customerJoinByQr, type CustomerCardItem } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export default function UserJoinPage() {
    const { t: tr } = useI18n();
    const router = useRouter();
    const searchParams = useSearchParams();
    const autoJoinStarted = useRef(false);
    const { token } = useCustomerAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cardsSnapshot, setCardsSnapshot] = useState<CustomerCardItem[] | null>(null);
    const reloadCards = async (): Promise<CustomerCardItem[]> => {
        if (!token)
            return [];
        const res = await customerCards(token);
        return res.data ?? [];
    };
    useEffect(() => {
        if (!token || autoJoinStarted.current)
            return;
        const join = searchParams.get("auto");
        const joinBusinessId = searchParams.get("auto_business_id");
        if (!join && !joinBusinessId)
            return;
        autoJoinStarted.current = true;
        setLoading(true);
        setError(null);
        const qr = join
            ? `${window.location.origin}/user/login?join=${encodeURIComponent(join)}`
            : `${window.location.origin}/user/login?join_business_id=${encodeURIComponent(joinBusinessId ?? "")}`;
        void customerJoinByQr(token, qr)
            .then((result) => {
            const membershipId = result.customer?.id;
            router.replace(membershipId ? `/user/cards?selected=${encodeURIComponent(membershipId)}` : "/user/cards");
        })
            .catch((err) => {
            autoJoinStarted.current = false;
            setError(err instanceof Error ? err.message : "Unable to join this business from QR");
        })
            .finally(() => setLoading(false));
    }, [router, searchParams, token]);
    return (<CustomerLayout title={tr("Join Loyalty Program")} subtitle={tr("Scan a QR code to add a loyalty card")}>
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{tr(" Point your camera at the business QR code. ")}</p>

            {error ? <p className="text-sm text-destructive">{tr(error)}</p> : null}
            {loading ? (<CustomerPageSkeleton variant="join"/>) : null}
          </CardContent>
        </Card>

        <StaffQrScanner onQrScanned={async (qrCode) => {
            if (!token)
                return false;
            if (loading)
                return false;
            setLoading(true);
            setError(null);
            try {
                const joinResult = await customerJoinByQr(token, qrCode);
                // Refresh cards first so we can auto-select newly added card.
                const refreshed = await reloadCards();
                setCardsSnapshot(refreshed);
                const membershipId = joinResult.customer?.id;
                router.push(membershipId ? `/user/cards?selected=${encodeURIComponent(membershipId)}` : "/user/cards");
                return true;
            }
            catch (err) {
                setError(err instanceof Error ? err.message : "Unable to join this business from QR");
                return false;
            }
            finally {
                setLoading(false);
            }
        }}/>

        {cardsSnapshot ? (<Button variant="outline" onClick={async () => router.push("/user/cards")} disabled={loading}>{tr(" View my cards ")}</Button>) : null}
      </div>
    </CustomerLayout>);
}
