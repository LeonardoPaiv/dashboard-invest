import { useState } from 'react';
import { Upload, Download, LayoutDashboard, Target, History, Landmark, Wallet, Calculator, Database, Menu, X } from 'lucide-react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import logo from '../assets/logo.png';
import { PortfolioSelector } from './PortfolioSelector';
import { ImportModal } from './ImportModal';

export const Sidebar = () => {
  const {
    activeTab,
    setActiveTab,
    loadBackup,
    portfolios,
    activePortfolioId,
    portfolio,
    settings,
    snapshots,
    customLists,
    equityHistory,
    monthlySnapshots,
    monthlyPlan,
    assetCategories,
    contributionAmount,
    importConfig,
    historicalTransactions
  } = useInvestmentStore();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedXlsxFile, setSelectedXlsxFile] = useState<File | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedXlsxFile(file);
      setIsImportModalOpen(true);
      setIsMobileMenuOpen(false);
      e.target.value = '';
    }
  };

  const handleExportBackup = () => {
    const data = {
      portfolios,
      activePortfolioId,
      portfolio,
      settings,
      snapshots,
      customLists,
      equityHistory,
      monthlySnapshots,
      monthlyPlan,
      assetCategories,
      contributionAmount,
      importConfig,
      historicalTransactions,
      version: '1.2',
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `investdash-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsMobileMenuOpen(false);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (confirm("Isso irá substituir todos os dados e carteiras atuais. Deseja continuar?")) {
            loadBackup(json);
            alert("Backup restaurado com sucesso!");
            setIsMobileMenuOpen(false);
          }
        } catch (err) {
          console.error("Error importing backup", err);
          alert("Arquivo de backup inválido.");
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const navItemsContent = (
    <nav className="flex-1 space-y-1">
      <NavItem
        icon={<LayoutDashboard size={18} />}
        label="Dashboard"
        active={activeTab === 'dashboard'}
        onClick={() => handleTabClick('dashboard')}
      />
      <NavItem
        icon={<Target size={18} />}
        label="Estratégia"
        active={activeTab === 'strategy'}
        onClick={() => handleTabClick('strategy')}
      />
      <NavItem
        icon={<Landmark size={18} />}
        label="Projeção"
        active={activeTab === 'projection'}
        onClick={() => handleTabClick('projection')}
      />
      <NavItem
        icon={<Wallet size={18} />}
        label="Plano Mensal"
        active={activeTab === 'plano-mensal'}
        onClick={() => handleTabClick('plano-mensal')}
      />
      <NavItem
        icon={<Calculator size={18} />}
        label="Preço Médio"
        active={activeTab === 'preco-medio'}
        onClick={() => handleTabClick('preco-medio')}
      />
      <NavItem
        icon={<Landmark size={18} />}
        label="Imposto de Renda"
        active={activeTab === 'imposto-renda'}
        onClick={() => handleTabClick('imposto-renda')}
      />
      <NavItem
        icon={<History size={18} />}
        label="Histórico"
        active={activeTab === 'history'}
        onClick={() => handleTabClick('history')}
      />
      <NavItem
        icon={<Upload size={18} />}
        label="Importar Planilha"
        active={isImportModalOpen}
        onClick={() => {
          setSelectedXlsxFile(null);
          setIsImportModalOpen(true);
          setIsMobileMenuOpen(false);
        }}
      />
      <NavItem
        icon={<Database size={18} />}
        label="Menu de Dados"
        active={activeTab === 'data-management'}
        onClick={() => handleTabClick('data-management')}
      />
    </nav>
  );

  const sidebarActionsContent = (
    <div className="mt-auto space-y-3 pt-4 border-t border-white/5 shrink-0">
      <label className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-white/20 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group">
        <Upload size={18} className="text-white/40 group-hover:text-primary shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/40 group-hover:text-white truncate">
          Importar Planilha
        </span>
        <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleExportBackup}
          className="flex flex-col items-center gap-1.5 p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
        >
          <Download size={15} className="text-white/40 group-hover:text-white" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">
            Backup
          </span>
        </button>

        <label className="flex flex-col items-center gap-1.5 p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer transition-all group text-center">
          <Upload size={15} className="text-white/40 group-hover:text-white" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">
            Restaurar
          </span>
          <input type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
        </label>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header Bar (< md) */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-white/10 sticky top-0 z-40 w-full shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10"
            aria-label="Abrir Menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <img src={logo} alt="Logo" className="h-7" />
        </div>

        <div className="w-48">
          <PortfolioSelector />
        </div>
      </div>

      {/* Mobile Slide-out Drawer Overlay (< md) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 bg-card border-r border-white/10 h-full p-5 z-50 flex flex-col overflow-y-auto custom-scrollbar animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-4">
              <img src={logo} alt="Logo" className="h-7" />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-white/40 hover:text-white rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5">
              <PortfolioSelector />
            </div>

            {navItemsContent}
            {sidebarActionsContent}
          </div>
        </div>
      )}

      {/* Desktop Sidebar (>= md) */}
      <div className="hidden md:flex w-64 h-screen bg-card border-r border-white/10 flex-col p-5 sticky top-0 z-30 overflow-y-auto custom-scrollbar shrink-0">
        {/* Logo Header */}
        <div className="flex items-center gap-3 mb-4">
          <img src={logo} alt="Logo" className="h-8" />
        </div>

        {/* Portfolio Quick Selector */}
        <div className="mb-6">
          <PortfolioSelector />
        </div>

        {navItemsContent}
        {sidebarActionsContent}
      </div>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setSelectedXlsxFile(null);
        }}
        initialFile={selectedXlsxFile}
      />
    </>
  );
};

const NavItem = ({
  icon,
  label,
  active,
  onClick
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-semibold ${
      active
        ? 'bg-primary text-white shadow-lg shadow-primary/20 font-bold'
        : 'text-white/50 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    <span className="truncate">{label}</span>
  </button>
);
