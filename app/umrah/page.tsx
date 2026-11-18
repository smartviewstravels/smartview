import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import FinanceList from "@/components/FinanceList";


export default async function UmrahPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const { customers, records } = await loadAll("umrah");

  return (
    <FinanceList
      type="umrah"
      title="Umrah"
      customers={customers}
      records={records}
      q={q}
    />
  );
}
