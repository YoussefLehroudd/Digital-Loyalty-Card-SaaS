"use client";
import LoyaltyCardVisual from "@/components/loyalty/LoyaltyCardVisual";
type Props = {
    businessName: string;
    businessLogoUrl?: string | null;
    heroImageUrl?: string | null;
    heroImageZoom?: number | null;
    heroImagePositionX?: number | null;
    heroImagePositionY?: number | null;
    brandPrimaryColor?: string | null;
    memberName?: string | null;
    cardNumber?: string | null;
    qrCode?: string | null;
    rewardName?: string | null;
    rewardDescription?: string | null;
    progressPercent: number;
    currentStamps: number;
    requiredStamps: number;
};
export default function LoyaltyCard({ businessName, businessLogoUrl, heroImageUrl, heroImageZoom, heroImagePositionX, heroImagePositionY, brandPrimaryColor, memberName, cardNumber, qrCode, rewardName, rewardDescription, progressPercent, currentStamps, requiredStamps, }: Props) {
    return (<LoyaltyCardVisual businessName={businessName} businessLogoUrl={businessLogoUrl} heroImageUrl={heroImageUrl} heroImageZoom={heroImageZoom} heroImagePositionX={heroImagePositionX} heroImagePositionY={heroImagePositionY} brandPrimaryColor={brandPrimaryColor} memberName={memberName} cardNumber={cardNumber} qrToken={qrCode} rewardName={rewardName} rewardDescription={rewardDescription} progressPercent={progressPercent} currentStamps={currentStamps} requiredStamps={requiredStamps}/>);
}
