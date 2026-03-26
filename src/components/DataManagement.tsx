import React, { useState, useEffect } from 'react';
import { Save, Download, Upload, Trash2, Database, AlertTriangle, CheckCircle, RefreshCcw, FileText } from 'lucide-react';
import { useInvestmentStore } from '../store/useInvestmentStore';

export const DataManagement = () => {
  const store = useInvestmentStore();
  const [jsonContent, setJsonContent] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  // Get current store state and format as JSON
  useEffect(() => {
    const { 
      portfolio, settings, snapshots, customLists, 
      equityHistory, monthlyPlan, assetCategories, 
      contributionAmount, importConfig, historicalTransactions 
    } = store;
    
    const data = {
      portfolio,
      settings,
      snapshots,
      customLists,
      equityHistory,
      monthlyPlan,
      assetCategories,
      contributionAmount,
      importConfig,
      historicalTransactions,
      version: '1.0',
      exportDate: new Date().toISOString()
    };
    
    setJsonContent(JSON.stringify(data, null, 2));
  }, []);

  const handleSaveJson = () => {
    try {
      const parsed = JSON.parse(jsonContent);
      if (confirm("Isso irá substituir os dados atuais pelos dados editados no JSON. Continuar?")) {
        store.loadBackup(parsed);
        setStatus({ type: 'success', message: 'Dados salvos com sucesso!' });
        setTimeout(() => setStatus({ type: null, message: '' }), 3000);
      }
    } catch (err) {
      console.error("Invalid JSON", err);
      setStatus({ type: 'error', message: 'JSON inválido. Verifique a formatação!' });
      setTimeout(() => setStatus({ type: null, message: '' }), 5000);
    }
  };

  const handleExportBackup = () => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `investdash-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus({ type: 'success', message: 'Download de backup iniciado!' });
    setTimeout(() => setStatus({ type: null, message: '' }), 3000);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (confirm("Isso irá substituir todos os dados atuais. Deseja continuar?")) {
            store.loadBackup(json);
            setJsonContent(JSON.stringify(json, null, 2));
            setStatus({ type: 'success', message: 'Backup restaurado com sucesso!' });
            setTimeout(() => setStatus({ type: null, message: '' }), 3000);
          }
        } catch (err) {
          console.error("Error importing backup", err);
          setStatus({ type: 'error', message: 'Arquivo de backup inválido.' });
          setTimeout(() => setStatus({ type: null, message: '' }), 5000);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const handleClearAll = () => {
    if (confirm("ATENÇÃO: Isso irá DELETAR PERMANENTEMENTE todos os seus dados (portfólio, metas, histórico, etc). Esta ação não pode ser desfeita. Tem certeza?")) {
      store.clearAllData();
      setJsonContent(JSON.stringify(store, null, 2)); // Re-update UI
      setStatus({ type: 'success', message: 'Todos os dados foram excluídos.' });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
      window.location.reload(); // Force reload to ensure everything is reset properly
    }
  };

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto bg-background/50 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-1">
            Menu de Dados
          </h1>
          <p className="text-white/60 font-medium">Gerencie seu LocalStorage, backups e configurações de dados.</p>
        </div>
        
        {status.type && (
          <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border ${
            status.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          } animate-in slide-in-from-top-4 duration-300`}>
            {status.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            <span className="font-semibold text-sm">{status.message}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          {/* Backup & Import Box */}
          <div className="p-6 bg-card border border-white/10 rounded-3xl space-y-4 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Database size={22} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold">Backup & Restauração</h2>
            </div>
            
            <p className="text-sm text-white/50 leading-relaxed">
              Exporte seus dados para um arquivo JSON para manter uma cópia de segurança ou migrar de dispositivo.
            </p>

            <div className="grid grid-cols-1 gap-2 pt-2">
              <button 
                onClick={handleExportBackup}
                className="flex items-center justify-center gap-3 p-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                <Download size={18} />
                <span>Exportar Backup (JSON)</span>
              </button>
              
              <label className="flex items-center justify-center gap-3 p-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all cursor-pointer group active:scale-95">
                <Upload size={18} className="text-white/40 group-hover:text-white" />
                <span>Importar Backup</span>
                <input type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
              </label>
            </div>
          </div>

          {/* Dangerous Actions Box */}
          <div className="p-6 bg-card border border-rose-500/10 rounded-3xl space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-rose-500/10 rounded-xl">
                <AlertTriangle size={22} className="text-rose-500" />
              </div>
              <h2 className="text-xl font-bold text-rose-500">Ações Perigosas</h2>
            </div>
            
            <p className="text-sm text-white/50 leading-relaxed">
              CUIDADO: Estas ações são IRREVERSÍVEIS. Recomendamos fazer um backup antes de prosseguir.
            </p>

            <button 
              onClick={handleClearAll}
              className="w-full flex items-center justify-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold rounded-2xl hover:bg-rose-500 hover:text-white transition-all active:scale-95"
            >
              <Trash2 size={18} />
              <span>Zerar Todos os Dados</span>
            </button>
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center p-8 border border-white/5 rounded-3xl text-center space-y-4 opacity-50">
             <div className="p-4 bg-white/5 rounded-full">
               <FileText size={48} className="text-white/20" />
             </div>
             <p className="text-xs uppercase tracking-widest font-black">Investment Dashboard v1.0</p>
          </div>
        </div>

        {/* Right Column - Editor */}
        <div className="lg:col-span-2 space-y-6 h-full flex flex-col">
          <div className="flex-1 flex flex-col p-6 bg-card border border-white/10 rounded-3xl space-y-4 min-h-[500px]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                  <Database size={22} className="text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold">Visualizador/Editor JSON</h2>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.location.reload()}
                  title="Recarregar dados"
                  className="p-3 bg-white/5 text-white/40 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all"
                >
                  <RefreshCcw size={16} />
                </button>
                <button 
                  onClick={handleSaveJson}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Save size={18} />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>

            <div className="flex-1 relative group">
              <textarea
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                className="w-full h-full p-6 bg-black/40 border border-white/10 rounded-2xl font-mono text-sm text-emerald-400/90 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none custom-scrollbar"
                spellCheck={false}
              />
              <div className="absolute top-4 right-4 px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/20 font-bold uppercase tracking-wider">
                LocalStorage (Raw JSON)
              </div>
            </div>
            
            <p className="text-[11px] text-white/30 italic text-center">
              * Edite o JSON acima diretamente para alterar campos específicos do LocalStorage. Use com cautela para não corromper os dados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
