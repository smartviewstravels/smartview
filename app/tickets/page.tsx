import { requireAdmin } from "@/lib/auth";
import { loadAll } from "@/components/data";
import FinanceList from "@/components/FinanceList";


export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const { customers, records } = await loadAll("ticket");

  return (
    <FinanceList
      type="ticket"
      title="Ticket"
      customers={customers}
      records={records}
      q={q}
    />
  );
}
