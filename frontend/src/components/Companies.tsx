import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Pencil, Plus, Search, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { requestJson } from './api';

type Props = { API_BASE: string };
type Company = {
  id: number;
  name: string;
  address: string;
  contact_person: string;
  mobile_number: string;
  is_active: number;
};
type CompanyForm = Pick<Company, 'name' | 'address' | 'contact_person' | 'mobile_number'>;

const emptyForm: CompanyForm = { name: '', address: '', contact_person: '', mobile_number: '' };
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function Companies({ API_BASE }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadCompanies(query = search) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('search', query.trim());
      const suffix = params.size ? `?${params}` : '';
      setCompanies(await requestJson<Company[]>(`${API_BASE}/companies${suffix}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load companies.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCompanies(search), 250);
    return () => window.clearTimeout(timer);
  }, [API_BASE, search]);

  function startEdit(company: Company) {
    setEditingId(company.id);
    setForm({
      name: company.name,
      address: company.address || '',
      contact_person: company.contact_person || '',
      mobile_number: company.mobile_number || '',
    });
    setNotice('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const url = editingId ? `${API_BASE}/companies/${editingId}` : `${API_BASE}/companies`;
      await requestJson<Company>(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setNotice(editingId ? 'Company updated.' : 'Company added.');
      resetForm();
      await loadCompanies();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save company.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompany(company: Company) {
    const action = company.is_active === 1 ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} ${company.name}?`)) return;
    setError('');
    setNotice('');
    try {
      await requestJson<{ id: number; is_active: number }>(`${API_BASE}/companies/${company.id}/toggle`, {
        method: 'PATCH',
      });
      setNotice(`${company.name} ${company.is_active === 1 ? 'deactivated' : 'activated'}.`);
      await loadCompanies();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update company status.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-600">Directory</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Companies</h1>
          <p className="mt-1 text-sm text-slate-500">Manage customer details and account status.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search companies"
            className={`${inputClass} mt-0 pl-9`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search companies"
          />
        </div>
      </header>

      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </div>
      )}

      <form onSubmit={saveCompany} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{editingId ? 'Edit company' : 'Add a company'}</h2>
          {editingId && (
            <button type="button" onClick={resetForm} aria-label="Cancel editing" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Company name <span className="text-red-500">*</span>
            <input required className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Contact person
            <input className={inputClass} value={form.contact_person} onChange={(event) => setForm({ ...form, contact_person: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Mobile number
            <input type="tel" className={inputClass} value={form.mobile_number} onChange={(event) => setForm({ ...form, mobile_number: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Address
            <input className={inputClass} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </label>
        </div>
        <button disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add company'}
        </button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Company list</h2>
          <span className="text-sm text-slate-500">{companies.length} shown</span>
        </div>
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Loading companies…</p>
        ) : companies.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">{search ? 'No matching companies.' : 'No companies yet. Add the first one above.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Company</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Mobile</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4"><p className="font-semibold text-slate-800">{company.name}</p><p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">{company.address || 'No address'}</p></td>
                    <td className="px-5 py-4 text-slate-600">{company.contact_person || '—'}</td>
                    <td className="px-5 py-4 text-slate-600">{company.mobile_number || '—'}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${company.is_active === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{company.is_active === 1 ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(company)} aria-label={`Edit ${company.name}`} className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => void toggleCompany(company)} aria-label={`${company.is_active === 1 ? 'Deactivate' : 'Activate'} ${company.name}`} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                          {company.is_active === 1 ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
