import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import FinanceList from "@/components/FinanceList";


export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const { customers, records } = await loadAll("tour");

  return (
    <FinanceList
      type="tour"
      title="Tours"
      customers={customers}
      records={records}
      q={q}
    />
  );
}
