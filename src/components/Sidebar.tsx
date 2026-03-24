import { Upload, Download, LayoutDashboard, Target, History, Landmark, Wallet } from 'lucide-react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import { parseInvestmentExcel } from '../utils/parser';

export const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: any) => void }) => {
  const { setPortfolio, addHistoryEntry, loadBackup, portfolio, settings, snapshots, customLists, equityHistory } = useInvestmentStore();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await parseInvestmentExcel(file);
        // Calculate total_live
        const total_live = [...data.fiis, ...data.acoes, ...data.tesouro, ...data.renda_fixa]
          .reduce((acc, curr) => acc + (curr.Posicao || 0), 0);
        
        setPortfolio({ ...data, total_live });
        addHistoryEntry(total_live);
        e.target.value = '';
      } catch (err) {
        console.error("Error parsing excel", err);
        alert("Erro ao processar planilha. Verifique o formato.");
      }
    }
  };

  const handleExportBackup = () => {
    const data = {
      portfolio,
      settings,
      snapshots,
      customLists,
      equityHistory,
      version: '1.0',
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
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (confirm("Isso irá substituir todos os dados atuais. Deseja continuar?")) {
            loadBackup(json);
            alert("Backup restaurado com sucesso!");
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

  return (
    <div className="w-64 h-screen bg-card border-r border-white/10 flex flex-col p-6 sticky top-0">
      <div className="flex items-center gap-3 mb-0">
        <img src="src/assets/logo.png" alt="Logo" />
      </div>

      <nav className="flex-1 space-y-2">
        <NavItem 
          icon={<LayoutDashboard size={20}/>} 
          label="Dashboard" 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
        />
        <NavItem 
          icon={<Target size={20}/>} 
          label="Estratégia" 
          active={activeTab === 'strategy'} 
          onClick={() => setActiveTab('strategy')} 
        />
        <NavItem 
          icon={<Landmark size={20}/>} 
          label="Projeção" 
          active={activeTab === 'projection'} 
          onClick={() => setActiveTab('projection')} 
        />
        <NavItem 
          icon={<Wallet size={20}/>} 
          label="Plano Mensal" 
          active={activeTab === 'plano-mensal'} 
          onClick={() => setActiveTab('plano-mensal')} 
        />
        <NavItem 
          icon={<History size={20}/>} 
          label="Histórico" 
          active={activeTab === 'history'} 
          onClick={() => setActiveTab('history')} 
        />
      </nav>

      <div className="mt-auto space-y-3 pt-6 border-t border-white/5">
        <label className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-white/20 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group">
          <Upload size={18} className="text-white/40 group-hover:text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-white/40 group-hover:text-white">Planilha XP.inc</span>
          <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={handleExportBackup}
            className="flex flex-col items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
          >
            <Download size={16} className="text-white/40 group-hover:text-white" />
            <span className="text-[10px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">Backup</span>
          </button>

          <label className="flex flex-col items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer transition-all group text-center">
            <Upload size={16} className="text-white/40 group-hover:text-white" />
            <span className="text-[10px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">Importar</span>
            <input type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
          </label>
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
        : 'text-white/50 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    <span className="font-semibold">{label}</span>
  </button>
);
