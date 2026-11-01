import { useState } from 'react';
import { Building2, Utensils, Coffee, FileText, LayoutDashboard, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Companies from './components/Companies';
import Rates from './components/Rates';
import TiffinEntries from './components/TiffinEntries';
import RefreshmentEntries from './components/RefreshmentEntries';
import Bills from './components/Bills';

// Setup API URL dynamically:
// Vite dev runs on port 5173, so point to Express on port 5000.
// In production, served from same port, so relative path is fine.
const API_BASE = window.location.port === '5173' ? 'http://localhost:5000/api' : '/api';
const today = () => new Date().toLocaleDateString('en-CA');

export default function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [entryDate, setEntryDate] = useState(today);

  function resetEntryDate() {
    setEntryDate(today());
  }

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
    { name: 'Companies', icon: Building2, view: 'companies' },
    { name: 'Item Rates Setup', icon: Settings, view: 'rates' },
    { name: 'Daily Tiffin Entry', icon: Utensils, view: 'tiffin' },
    { name: 'Daily Nasta Entry', icon: Coffee, view: 'refreshment' },
    { name: 'Monthly Bills', icon: FileText, view: 'bills' },
  ];

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard setView={setCurrentView} API_BASE={API_BASE} />;
      case 'companies':
        return <Companies API_BASE={API_BASE} />;
      case 'rates':
        return <Rates API_BASE={API_BASE} />;
      case 'tiffin':
        return <TiffinEntries API_BASE={API_BASE} entryDate={entryDate} onEntryDateChange={setEntryDate} />;
      case 'refreshment':
        return <RefreshmentEntries API_BASE={API_BASE} entryDate={entryDate} onEntryDateChange={setEntryDate} />;
      case 'bills':
        return <Bills API_BASE={API_BASE} onBillExport={resetEntryDate} />;
      default:
        return <Dashboard setView={setCurrentView} API_BASE={API_BASE} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shadow-lg">
        {/* Sidebar Header */}
        <div className="px-6 py-5 bg-slate-950 flex items-center space-x-3 border-b border-slate-800">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-white tracking-wide leading-tight">OFFICE TIFFIN</h2>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Billing System</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 text-center font-medium">
          Office Billing System v1.0.0
        </div>
      </aside>

      {/* Main Page Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-8 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{currentView}</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-500">Local Service Online</span>
          </div>
        </header>

        {/* Inner page content container */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {renderActiveView()}
          </div>
        </div>
      </main>
    </div>
  );
}
