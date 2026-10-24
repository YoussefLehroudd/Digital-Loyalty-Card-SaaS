import MarketingHome from "@/components/marketing/home";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata = marketingMetadata("ar");

export default function Page() { return <MarketingHome locale="ar" />; }
