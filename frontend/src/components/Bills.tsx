import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, ReceiptText } from 'lucide-react';
import { currentMonthYear, formatDate, formatMoney, requestJson } from './api';

type Props = { API_BASE: string };
type Company = { id: number; name: string; is_active: number };
type Period = { month: number; monthName: string; year: number };
type TiffinBill = {
  billType: 'TIFFIN';
  company: { id: number; name: string; address: string; contactPerson: string; mobileNumber: string; isActive: number };
  period: Period;
  rates: { regularTiffinRate: number; dahiTiffinRate: number };
  entries: { id: number; date: string; requisitionNo: string; regularTiffinCount: number; dahiTiffinCount: number }[];
  totals: { regularTiffinCount: number; dahiTiffinCount: number };
  amounts: { regularTiffinAmount: number; dahiTiffinAmount: number; grandTotal: number };
};
type RefreshmentBill = {
  billType: 'REFRESHMENT';
  company: { id: number; name: string; address: string; contactPerson: string; mobileNumber: string; isActive: number };
  period: Period;
  rates: { nastaRate: number; teaRate: number; milkRate: number; chapatiRate: number };
  entries: { id: number; date: string; requisitionNo: string; nastaCount: number; teaCount: number; milkLitres: number; chapatiCount: number }[];
  totals: { nastaCount: number; teaCount: number; milkLitres: number; chapatiCount: number };
  amounts: { nastaAmount: number; teaAmount: number; milkAmount: number; chapatiAmount: number; grandTotal: number };
};
type Bill = TiffinBill | RefreshmentBill;
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function Bills({ API_BASE }: Props) {
  const period = currentMonthYear();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [billType, setBillType] = useState<'tiffin' | 'refreshment'>('tiffin');
  const [month, setMonth] = useState(String(period.month));
  const [year, setYear] = useState(String(period.year));
  const [bill, setBill] = useState<Bill | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    requestJson<Company[]>(`${API_BASE}/companies`)
      .then((result) => {
        if (active) {
          setCompanies(result);
          setCompanyId((current) => current || (result[0] ? String(result[0].id) : ''));
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load companies.');
      })
      .finally(() => { if (active) setLoadingCompanies(false); });
    return () => { active = false; };
  }, [API_BASE]);

  function parameters() {
    return new URLSearchParams({ company_id: companyId, month, year });
  }

  async function loadBill() {
    if (!companyId || !month || !year) {
      setError('Select a company, month, and year to preview a bill.');
      setBill(null);
      return;
    }
    setLoadingBill(true);
    setError('');
    setBill(null);
    try {
      const result = await requestJson<Bill>(`${API_BASE}/bills/${billType}/preview?${parameters()}`);
      setBill(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to generate bill preview.');
    } finally {
      setLoadingBill(false);
    }
  }

  const exportUrl = (format: 'pdf' | 'excel') =>
    `${API_BASE}/bills/${billType}/${format}?${parameters().toString()}`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-600">Billing</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Monthly Bills</h1>
        <p className="mt-1 text-sm text-slate-500">Preview and export a company&apos;s monthly tiffin or nasta bill.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Company
            <select className={inputClass} value={companyId} disabled={loadingCompanies || companies.length === 0} onChange={(event) => { setCompanyId(event.target.value); setBill(null); }}>
              {companies.length === 0 && <option value="">No companies available</option>}
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}{company.is_active !== 1 ? ' (inactive)' : ''}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Bill type
            <select className={inputClass} value={billType} onChange={(event) => { setBillType(event.target.value as 'tiffin' | 'refreshment'); setBill(null); }}>
              <option value="tiffin">Tiffin</option><option value="refreshment">Nasta &amp; Refreshment</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Month
            <select className={inputClass} value={month} onChange={(event) => { setMonth(event.target.value); setBill(null); }}>
              {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index).toLocaleString(undefined, { month: 'long' })}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Year
            <input type="number" min="2000" max="2100" className={inputClass} value={year} onChange={(event) => { setYear(event.target.value); setBill(null); }} />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">The preview uses saved company rates and entries for the selected month.</p>
          <button onClick={() => void loadBill()} disabled={loadingBill || loadingCompanies || !companyId} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            <ReceiptText className="h-4 w-4" /> {loadingBill ? 'Generating…' : 'Generate preview'}
          </button>
        </div>
      </section>

      {!bill && !loadingBill && !error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <ReceiptText className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">{companies.length ? 'Choose the bill details and generate a preview.' : 'Add a company to generate bills.'}</p>
          <p className="mt-1 text-sm text-slate-500">The bill will include the month&apos;s entries, rates, and calculated total.</p>
        </div>
      )}

      {bill && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{bill.billType === 'TIFFIN' ? 'Tiffin bill' : 'Nasta & refreshment bill'}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{bill.company.name}</h2>
              {bill.company.address && <p className="mt-1 text-sm text-slate-500">{bill.company.address}</p>}
              {(bill.company.contactPerson || bill.company.mobileNumber) && <p className="mt-1 text-xs text-slate-500">{[bill.company.contactPerson, bill.company.mobileNumber].filter(Boolean).join(' · ')}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-700">{bill.period.monthName} {bill.period.year}</p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <a href={exportUrl('pdf')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <FileText className="h-4 w-4" /> PDF <Download className="h-3.5 w-3.5" />
                </a>
                <a href={exportUrl('excel')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <FileSpreadsheet className="h-4 w-4" /> Excel <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {bill.billType === 'TIFFIN' ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-white text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Requisition</th><th className="px-5 py-3 text-right">Regular</th><th className="px-5 py-3 text-right">Dahi</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{bill.entries.map((entry) => <tr key={entry.id}><td className="px-5 py-3 text-slate-600">{formatDate(entry.date)}</td><td className="px-5 py-3 text-slate-600">{entry.requisitionNo}</td><td className="px-5 py-3 text-right">{entry.regularTiffinCount}</td><td className="px-5 py-3 text-right">{entry.dahiTiffinCount}</td></tr>)}</tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800"><tr><td colSpan={2} className="px-5 py-3">Monthly total</td><td className="px-5 py-3 text-right">{bill.totals.regularTiffinCount}</td><td className="px-5 py-3 text-right">{bill.totals.dahiTiffinCount}</td></tr></tfoot>
                </table>
              </div>
              <div className="ml-auto max-w-sm space-y-2 p-5 text-sm">
                <div className="flex justify-between gap-6 text-slate-600"><span>Regular ({bill.totals.regularTiffinCount} × {formatMoney(bill.rates.regularTiffinRate)})</span><span>{formatMoney(bill.amounts.regularTiffinAmount)}</span></div>
                <div className="flex justify-between gap-6 text-slate-600"><span>Dahi ({bill.totals.dahiTiffinCount} × {formatMoney(bill.rates.dahiTiffinRate)})</span><span>{formatMoney(bill.amounts.dahiTiffinAmount)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900"><span>Grand total</span><span>{formatMoney(bill.amounts.grandTotal)}</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-white text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Requisition</th><th className="px-5 py-3 text-right">Nasta</th><th className="px-5 py-3 text-right">Tea</th><th className="px-5 py-3 text-right">Milk (L)</th><th className="px-5 py-3 text-right">Chapati</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{bill.entries.map((entry) => <tr key={entry.id}><td className="px-5 py-3 text-slate-600">{formatDate(entry.date)}</td><td className="px-5 py-3 text-slate-600">{entry.requisitionNo}</td><td className="px-5 py-3 text-right">{entry.nastaCount}</td><td className="px-5 py-3 text-right">{entry.teaCount}</td><td className="px-5 py-3 text-right">{Number(entry.milkLitres).toFixed(2)}</td><td className="px-5 py-3 text-right">{entry.chapatiCount}</td></tr>)}</tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800"><tr><td colSpan={2} className="px-5 py-3">Monthly total</td><td className="px-5 py-3 text-right">{bill.totals.nastaCount}</td><td className="px-5 py-3 text-right">{bill.totals.teaCount}</td><td className="px-5 py-3 text-right">{bill.totals.milkLitres.toFixed(2)}</td><td className="px-5 py-3 text-right">{bill.totals.chapatiCount}</td></tr></tfoot>
                </table>
              </div>
              <div className="ml-auto max-w-sm space-y-2 p-5 text-sm">
                <div className="flex justify-between gap-6 text-slate-600"><span>Nasta ({bill.totals.nastaCount} × {formatMoney(bill.rates.nastaRate)})</span><span>{formatMoney(bill.amounts.nastaAmount)}</span></div>
                <div className="flex justify-between gap-6 text-slate-600"><span>Tea ({bill.totals.teaCount} × {formatMoney(bill.rates.teaRate)})</span><span>{formatMoney(bill.amounts.teaAmount)}</span></div>
                <div className="flex justify-between gap-6 text-slate-600"><span>Milk ({bill.totals.milkLitres} L × {formatMoney(bill.rates.milkRate)})</span><span>{formatMoney(bill.amounts.milkAmount)}</span></div>
                <div className="flex justify-between gap-6 text-slate-600"><span>Chapati ({bill.totals.chapatiCount} × {formatMoney(bill.rates.chapatiRate)})</span><span>{formatMoney(bill.amounts.chapatiAmount)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900"><span>Grand total</span><span>{formatMoney(bill.amounts.grandTotal)}</span></div>
              </div>
            </>
          )}
          {bill.entries.length === 0 && <p className="border-t border-slate-100 px-5 py-4 text-center text-sm text-slate-500">No entries for this company and month. The bill total is zero.</p>}
        </section>
      )}
    </div>
  );
}
