import { useEffect, useState, type FormEvent } from 'react';
import { Coffee, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { currentMonthYear, formatDate, requestJson } from './api';

type Props = { API_BASE: string };
type Company = { id: number; name: string; is_active: number };
type Entry = {
  id: number;
  company_id: number;
  company_name: string;
  entry_date: string;
  requisition_no: string;
  nasta_count: number;
  tea_count: number;
  milk_litres: number;
  chapati_count: number;
};
type EntryForm = {
  company_id: string;
  entry_date: string;
  requisition_no: string;
  nasta_count: string;
  tea_count: string;
  milk_litres: string;
  chapati_count: string;
};
const today = new Date().toLocaleDateString('en-CA');
const emptyForm = (): EntryForm => ({
  company_id: '',
  entry_date: today,
  requisition_no: '',
  nasta_count: '0',
  tea_count: '0',
  milk_litres: '0',
  chapati_count: '0',
});
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function RefreshmentEntries({ API_BASE }: Props) {
  const initialPeriod = currentMonthYear();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [month, setMonth] = useState(String(initialPeriod.month));
  const [year, setYear] = useState(String(initialPeriod.year));
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [totals, setTotals] = useState({ nasta: 0, tea: 0, milk: 0, chapati: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void requestJson<Company[]>(`${API_BASE}/companies`)
      .then(setCompanies)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load companies.'));
  }, [API_BASE]);

  useEffect(() => {
    let active = true;
    async function loadEntries() {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ month, year });
      if (companyFilter) params.set('company_id', companyFilter);
      if (search.trim()) params.set('requisition_no', search.trim());
      try {
        const result = await requestJson<Entry[]>(`${API_BASE}/refreshment-entries?${params}`);
        if (active) setEntries(result);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load nasta entries.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadEntries();
    return () => { active = false; };
  }, [API_BASE, companyFilter, month, year, search]);

  useEffect(() => {
    if (!companyFilter) {
      setTotals({
        nasta: entries.reduce((sum, entry) => sum + Number(entry.nasta_count), 0),
        tea: entries.reduce((sum, entry) => sum + Number(entry.tea_count), 0),
        milk: Math.round(entries.reduce((sum, entry) => sum + Number(entry.milk_litres), 0) * 100) / 100,
        chapati: entries.reduce((sum, entry) => sum + Number(entry.chapati_count), 0),
      });
      return;
    }
    let active = true;
    const params = new URLSearchParams({ company_id: companyFilter, month, year });
    void requestJson<{ totalNasta: number; totalTea: number; totalMilkLitres: number; totalChapati: number }>(`${API_BASE}/refreshment-entries/totals?${params}`)
      .then((result) => {
        if (active) setTotals({ nasta: result.totalNasta, tea: result.totalTea, milk: result.totalMilkLitres, chapati: result.totalChapati });
      })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load monthly totals.'); });
    return () => { active = false; };
  }, [API_BASE, companyFilter, entries, month, year]);

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm(), company_id: companyFilter });
  }

  function editEntry(entry: Entry) {
    setEditingId(entry.id);
    setForm({
      company_id: String(entry.company_id),
      entry_date: entry.entry_date,
      requisition_no: entry.requisition_no,
      nasta_count: String(entry.nasta_count),
      tea_count: String(entry.tea_count),
      milk_litres: String(entry.milk_litres),
      chapati_count: String(entry.chapati_count),
    });
    setNotice('');
  }

  async function refreshEntries() {
    const params = new URLSearchParams({ month, year });
    if (companyFilter) params.set('company_id', companyFilter);
    if (search.trim()) params.set('requisition_no', search.trim());
    setEntries(await requestJson<Entry[]>(`${API_BASE}/refreshment-entries?${params}`));
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await requestJson<Entry>(editingId ? `${API_BASE}/refreshment-entries/${editingId}` : `${API_BASE}/refreshment-entries`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setNotice(editingId ? 'Nasta entry updated.' : 'Nasta entry added.');
      resetForm();
      await refreshEntries();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save nasta entry.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry: Entry) {
    if (!window.confirm(`Delete requisition ${entry.requisition_no} for ${entry.company_name}?`)) return;
    setError('');
    setNotice('');
    try {
      await requestJson<{ id: number }>(`${API_BASE}/refreshment-entries/${entry.id}`, { method: 'DELETE' });
      setNotice('Nasta entry deleted.');
      await refreshEntries();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete nasta entry.');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-600">Daily records</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Daily Nasta Entry</h1>
        <p className="mt-1 text-sm text-slate-500">Record nasta, tea, milk, and chapati against company requisitions.</p>
      </header>

      {(error || notice) && <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}

      <form onSubmit={saveEntry} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{editingId ? 'Edit nasta entry' : 'Add nasta entry'}</h2>
          {editingId && <button type="button" onClick={resetForm} aria-label="Cancel editing" className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Company *
            <select required className={inputClass} value={form.company_id} onChange={(event) => setForm({ ...form, company_id: event.target.value })}>
              <option value="">Select a company</option>
              {companies.map((company) => <option key={company.id} value={company.id} disabled={company.is_active !== 1 && String(company.id) !== form.company_id}>{company.name}{company.is_active !== 1 ? ' (inactive)' : ''}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Date *
            <input required type="date" className={inputClass} value={form.entry_date} onChange={(event) => setForm({ ...form, entry_date: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">Requisition number *
            <input required className={inputClass} value={form.requisition_no} onChange={(event) => setForm({ ...form, requisition_no: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">Nasta
            <input type="number" min="0" step="1" className={inputClass} value={form.nasta_count} onChange={(event) => setForm({ ...form, nasta_count: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">Tea
            <input type="number" min="0" step="1" className={inputClass} value={form.tea_count} onChange={(event) => setForm({ ...form, tea_count: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">Milk (litres)
            <input type="number" min="0" step="0.01" className={inputClass} value={form.milk_litres} onChange={(event) => setForm({ ...form, milk_litres: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">Chapati
            <input type="number" min="0" step="1" className={inputClass} value={form.chapati_count} onChange={(event) => setForm({ ...form, chapati_count: event.target.value })} />
          </label>
        </div>
        <button disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add entry'}
        </button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-5">
          <div><h2 className="font-semibold text-slate-900">Nasta entries</h2><p className="mt-1 text-xs text-slate-500">Filter and review recorded requisitions.</p></div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2 lg:grid-cols-4">
            <select aria-label="Filter by company" className={inputClass + ' mt-0'} value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
              <option value="">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
            <select aria-label="Filter by month" className={inputClass + ' mt-0'} value={month} onChange={(event) => setMonth(event.target.value)}>
              {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index).toLocaleString(undefined, { month: 'long' })}</option>)}
            </select>
            <input aria-label="Filter by year" type="number" min="2000" max="2100" className={inputClass + ' mt-0'} value={year} onChange={(event) => setYear(event.target.value)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input aria-label="Search requisition number" className={inputClass + ' mt-0 pl-9'} placeholder="Requisition" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-white px-4 py-3 text-sm"><span className="text-slate-500">Nasta</span><strong className="ml-2 text-slate-900">{totals.nasta.toLocaleString()}</strong></div>
          <div className="rounded-lg bg-white px-4 py-3 text-sm"><span className="text-slate-500">Tea</span><strong className="ml-2 text-slate-900">{totals.tea.toLocaleString()}</strong></div>
          <div className="rounded-lg bg-white px-4 py-3 text-sm"><span className="text-slate-500">Milk</span><strong className="ml-2 text-slate-900">{totals.milk.toLocaleString()} L</strong></div>
          <div className="rounded-lg bg-white px-4 py-3 text-sm"><span className="text-slate-500">Chapati</span><strong className="ml-2 text-slate-900">{totals.chapati.toLocaleString()}</strong></div>
        </div>
        {loading ? <p className="px-5 py-10 text-center text-sm text-slate-500">Loading entries…</p> : entries.length === 0 ? (
          <div className="px-5 py-10 text-center"><Coffee className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm text-slate-500">No nasta entries match these filters.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Requisition</th><th className="px-5 py-3 text-right">Nasta</th><th className="px-5 py-3 text-right">Tea</th><th className="px-5 py-3 text-right">Milk (L)</th><th className="px-5 py-3 text-right">Chapati</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatDate(entry.entry_date)}</td><td className="px-5 py-3.5 font-medium text-slate-800">{entry.company_name}</td><td className="px-5 py-3.5 text-slate-600">{entry.requisition_no}</td><td className="px-5 py-3.5 text-right tabular-nums">{entry.nasta_count}</td><td className="px-5 py-3.5 text-right tabular-nums">{entry.tea_count}</td><td className="px-5 py-3.5 text-right tabular-nums">{Number(entry.milk_litres).toFixed(2)}</td><td className="px-5 py-3.5 text-right tabular-nums">{entry.chapati_count}</td>
                  <td className="px-5 py-3.5"><div className="flex justify-end gap-1"><button onClick={() => editEntry(entry)} aria-label={`Edit requisition ${entry.requisition_no}`} className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil className="h-4 w-4" /></button><button onClick={() => void deleteEntry(entry)} aria-label={`Delete requisition ${entry.requisition_no}`} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
