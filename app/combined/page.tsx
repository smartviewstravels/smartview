import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import FinanceList from "@/components/FinanceList";


export default async function CombinedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const { customers, records, vendors } = await loadAll("combined");

  return (
    <FinanceList
      type="combined"
      title="Umrah + Ticket"
      customers={customers}
      records={records}
      vendors={vendors}
      q={q}
    />
  );
}
