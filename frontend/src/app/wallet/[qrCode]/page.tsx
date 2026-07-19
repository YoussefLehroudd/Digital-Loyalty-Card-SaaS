import { PublicCustomerWalletPage } from "@/components/loyalty/PublicCustomerWalletPage";

type PageProps = {
  params: Promise<{ qrCode: string }>;
};

export default async function WalletPage({ params }: PageProps) {
  const { qrCode } = await params;

  return <PublicCustomerWalletPage qrCode={qrCode} />;
}
