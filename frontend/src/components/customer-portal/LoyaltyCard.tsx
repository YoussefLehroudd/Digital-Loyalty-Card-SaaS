"use client";

import LoyaltyCardVisual from "@/components/loyalty/LoyaltyCardVisual";

type Props = {
  businessName: string;
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

export default function LoyaltyCard({
  businessName,
  brandPrimaryColor,
  memberName,
  cardNumber,
  qrCode,
  rewardName,
  rewardDescription,
  progressPercent,
  currentStamps,
  requiredStamps,
}: Props) {
  return (
    <LoyaltyCardVisual
      businessName={businessName}
      brandPrimaryColor={brandPrimaryColor}
      memberName={memberName}
      cardNumber={cardNumber}
      qrToken={qrCode}
      rewardName={rewardName}
      rewardDescription={rewardDescription}
      progressPercent={progressPercent}
      currentStamps={currentStamps}
      requiredStamps={requiredStamps}
    />
  );
}
