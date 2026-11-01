import { useEffect, useState, type FormEvent } from 'react';
import { BadgeDollarSign, Save } from 'lucide-react';
import { requestJson } from './api';

type Props = { API_BASE: string };
type Company = { id: number; name: string; is_active: number };
type RateFields = {
  regular_tiffin_rate: string;
  dahi_tiffin_rate: string;
  nasta_rate: string;
  tea_rate: string;
  milk_rate: string;
  chapati_rate: string;
};
type Rates = RateFields & { company_id: number };

const emptyRates: RateFields = {
  regular_tiffin_rate: '0',
  dahi_tiffin_rate: '0',
  nasta_rate: '0',
  tea_rate: '0',
  milk_rate: '0',
  chapati_rate: '0',
};
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const fields: { key: keyof RateFields; label: string; unit: string }[] = [
  { key: 'regular_tiffin_rate', label: 'Regular tiffin', unit: 'per meal' },
  { key: 'dahi_tiffin_rate', label: 'Dahi tiffin', unit: 'per meal' },
  { key: 'nasta_rate', label: 'Nasta', unit: 'per serving' },
  { key: 'tea_rate', label: 'Tea', unit: 'per cup' },
  { key: 'milk_rate', label: 'Milk', unit: 'per litre' },
  { key: 'chapati_rate', label: 'Chapati', unit: 'per piece' },
];

export default function Rates({ API_BASE }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [rates, setRates] = useState<RateFields>(emptyRates);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    async function loadCompanies() {
      setLoading(true);
      setError('');
      try {
        const result = await requestJson<Company[]>(`${API_BASE}/companies`);
        if (!active) return;
        setCompanies(result);
        setCompanyId((current) => current || (result[0] ? String(result[0].id) : ''));
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load companies.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadCompanies();
    return () => { active = false; };
  }, [API_BASE]);

  useEffect(() => {
    if (!companyId) {
      setRates(emptyRates);
      return;
    }
    let active = true;
    async function loadRates() {
      setLoading(true);
      setError('');
      setNotice('');
      try {
        const result = await requestJson<Rates>(`${API_BASE}/rates/${companyId}`);
        if (active) {
          setRates({
            regular_tiffin_rate: String(result.regular_tiffin_rate ?? 0),
            dahi_tiffin_rate: String(result.dahi_tiffin_rate ?? 0),
            nasta_rate: String(result.nasta_rate ?? 0),
            tea_rate: String(result.tea_rate ?? 0),
            milk_rate: String(result.milk_rate ?? 0),
            chapati_rate: String(result.chapati_rate ?? 0),
          });
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load rates.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadRates();
    return () => { active = false; };
  }, [API_BASE, companyId]);

  async function saveRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await requestJson<Rates>(`${API_BASE}/rates/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rates),
      });
      setNotice('Rates saved successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save rates.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-600">Pricing</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Item Rates Setup</h1>
        <p className="mt-1 text-sm text-slate-500">Set the billing rates used to calculate each company&apos;s monthly bills.</p>
      </header>

      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block max-w-md text-sm font-medium text-slate-700">
          Company
          <select className={inputClass} value={companyId} disabled={loading || companies.length === 0} onChange={(event) => setCompanyId(event.target.value)}>
            {companies.length === 0 && <option value="">No companies available</option>}
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}{company.is_active !== 1 ? ' (inactive)' : ''}</option>)}
          </select>
        </label>

        {companies.length === 0 && !loading ? (
          <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Add a company before setting item rates.</p>
        ) : (
          <form onSubmit={saveRates} className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(({ key, label, unit }) => (
                <label key={key} className="rounded-lg border border-slate-200 p-4 text-sm font-medium text-slate-700">
                  <span className="flex items-center justify-between gap-2">
                    {label}<span className="text-xs font-normal text-slate-400">{unit}</span>
                  </span>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      className={`${inputClass} mt-0 pl-7`}
                      value={rates[key]}
                      onChange={(event) => setRates({ ...rates, [key]: event.target.value })}
                    />
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Rates must be zero or greater. Blank rates are treated as zero.</p>
              <button disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save rates'}
              </button>
            </div>
          </form>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <BadgeDollarSign className="mt-0.5 h-5 w-5 shrink-0" />
        <p>These rates are applied to the monthly totals for the selected company when generating tiffin and nasta bills.</p>
      </div>
    </div>
  );
}
