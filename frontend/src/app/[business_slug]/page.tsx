import { PublicBusinessPage } from "@/components/loyalty/PublicBusinessPage";

type PageProps = {
  params: Promise<{ business_slug: string }>;
};

export default async function BusinessSlugPage({ params }: PageProps) {
  const { business_slug } = await params;

  return <PublicBusinessPage businessSlug={business_slug} />;
}
