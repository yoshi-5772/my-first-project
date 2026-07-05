import DraftReview from "@/components/DraftReview";

export default async function DraftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DraftReview token={token} />;
}
