import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Coffee,
  RefreshCw,
  TrendingUp,
  Utensils,
  Users,
} from 'lucide-react';

type DashboardProps = {
  setView: (view: string) => void;
  API_BASE: string;
};

type Company = {
  id: number;
  name: string;
  is_active: number;
};

type TiffinEntry = {
  id: number;
  company_name: string;
  entry_date: string;
  requisition_no: string;
  regular_tiffin_count: number;
  dahi_tiffin_count: number;
};

type RefreshmentEntry = {
  id: number;
  company_name: string;
  entry_date: string;
  requisition_no: string;
  nasta_count: number;
  tea_count: number;
  milk_litres: number;
  chapati_count: number;
};

type DashboardData = {
  companies: Company[];
  tiffinEntries: TiffinEntry[];
  refreshmentEntries: RefreshmentEntry[];
};

async function fetchList<T>(url: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T[]>;
}

export default function Dashboard({ setView, API_BASE }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const now = new Date();
    const params = new URLSearchParams({
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    });

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const [companies, tiffinEntries, refreshmentEntries] = await Promise.all([
          fetchList<Company>(`${API_BASE}/companies`, controller.signal),
          fetchList<TiffinEntry>(`${API_BASE}/tiffin-entries?${params}`, controller.signal),
          fetchList<RefreshmentEntry>(`${API_BASE}/refreshment-entries?${params}`, controller.signal),
        ]);
        setData({ companies, tiffinEntries, refreshmentEntries });
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [API_BASE, retryCount]);

  const tiffinEntries = data?.tiffinEntries ?? [];
  const refreshmentEntries = data?.refreshmentEntries ?? [];
  const totalTiffins = tiffinEntries.reduce(
    (total, entry) => total + Number(entry.regular_tiffin_count) + Number(entry.dahi_tiffin_count),
    0,
  );
  const totalRefreshments = refreshmentEntries.reduce(
    (total, entry) =>
      total +
      Number(entry.nasta_count) +
      Number(entry.tea_count) +
      Number(entry.milk_litres) +
      Number(entry.chapati_count),
    0,
  );
  const activeCompanies = data?.companies.filter((company) => company.is_active === 1).length ?? 0;
  const recentEntries = [
    ...tiffinEntries.map((entry) => ({
      id: `tiffin-${entry.id}`,
      type: 'Tiffin',
      company: entry.company_name,
      date: entry.entry_date,
      requisition: entry.requisition_no,
    })),
    ...refreshmentEntries.map((entry) => ({
      id: `refreshment-${entry.id}`,
      type: 'Nasta',
      company: entry.company_name,
      date: entry.entry_date,
      requisition: entry.requisition_no,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date) || b.requisition.localeCompare(a.requisition))
    .slice(0, 5);

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date());
  const cards = [
    {
      label: 'Active companies',
      value: activeCompanies,
      detail: `${data?.companies.length ?? 0} companies total`,
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Tiffin entries',
      value: tiffinEntries.length,
      detail: `${totalTiffins} meals recorded`,
      icon: Utensils,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Nasta entries',
      value: refreshmentEntries.length,
      detail: `${totalRefreshments} items recorded`,
      icon: Coffee,
      color: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-600">{monthLabel}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">A summary of this month&apos;s billing activity.</p>
        </div>
        <button
          onClick={() => setView('tiffin')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Add daily entry <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Could not load dashboard data: {error}</span>
          <button
            onClick={() => setRetryCount((count) => count + 1)}
            className="inline-flex items-center gap-2 font-semibold hover:text-red-900"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      <section aria-label="Monthly summary" className="grid gap-4 md:grid-cols-3">
        {cards.map(({ label, value, detail, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {loading ? '—' : value.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-slate-500">{loading ? 'Loading summary…' : detail}</p>
              </div>
              <span className={`rounded-lg p-2.5 ${color}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Recent entries</h2>
            <p className="mt-1 text-xs text-slate-500">Latest tiffin and nasta entries for this month</p>
          </div>
          <TrendingUp className="h-5 w-5 text-slate-400" />
        </div>

        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Loading recent entries…</p>
        ) : recentEntries.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-medium text-slate-700">No entries recorded this month</p>
            <p className="mt-1 text-sm text-slate-500">Add a daily entry to see activity here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentEntries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`rounded-md p-2 ${entry.type === 'Tiffin' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {entry.type === 'Tiffin' ? <Utensils className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{entry.company}</p>
                    <p className="text-xs text-slate-500">{entry.type} · Req. {entry.requisition}</p>
                  </div>
                </div>
                <time dateTime={entry.date} className="text-sm text-slate-500">
                  {new Date(`${entry.date}T00:00:00`).toLocaleDateString()}
                </time>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-3">
          <button
            onClick={() => setView('bills')}
            className="text-sm font-semibold text-blue-600 transition hover:text-blue-800"
          >
            View monthly bills
          </button>
        </div>
      </section>
    </div>
  );
}
