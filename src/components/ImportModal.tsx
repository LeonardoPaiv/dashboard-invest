import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, FileSpreadsheet, Check, RefreshCcw, Plus, Layers, AlertCircle } from 'lucide-react';
import { useInvestmentStore, PortfolioData } from '../store/useInvestmentStore';
import { parseInvestmentExcel } from '../utils/parser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialFile?: File | null;
}

export const ImportModal: React.FC<Props> = ({ isOpen, onClose, initialFile }) => {
  const { portfolios, activePortfolioId, setPortfolioData, addPortfolio, importConfig, addHistoryEntry } = useInvestmentStore();
  const [_file, setFile] = useState<File | null>(initialFile || null);
  const [parsedData, setParsedData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('existing');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    activePortfolioId !== 'all' ? activePortfolioId : portfolios[0]?.id || 'default'
  );
  const [newPortfolioName, setNewPortfolioName] = useState<string>('');
  const [importBehavior, setImportBehavior] = useState<'replace' | 'merge'>('replace');

  React.useEffect(() => {
    if (initialFile) {
      handleParseFile(initialFile);
    }
  }, [initialFile]);

  if (!isOpen) return null;

  const handleParseFile = async (f: File) => {
    setFile(f);
    setLoading(true);
    setError(null);
    try {
      const data = await parseInvestmentExcel(f, importConfig);
      const totalAssetsCount = data.fiis.length + data.acoes.length + data.tesouro.length + data.renda_fixa.length;
      
      if (totalAssetsCount === 0) {
        setError("Nenhum dado de investimento foi encontrado no arquivo. Verifique se os 'Textos Gatilhos' (Triggers) estão configurados na aba de Importação.");
        setParsedData(null);
      } else {
        const total_live = [...data.fiis, ...data.acoes, ...data.tesouro, ...data.renda_fixa]
          .reduce((acc, curr) => acc + (curr.Posicao || 0), 0);
        setParsedData({ ...data, manualAssets: [], total_live });

        const baseName = f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setNewPortfolioName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
    } catch (err: any) {
      console.error("Error parsing excel", err);
      setError("Erro ao ler e processar a planilha. Verifique o formato do arquivo.");
      setParsedData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleParseFile(e.target.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData) return;

    let targetId = selectedPortfolioId;
    if (targetMode === 'new') {
      const name = newPortfolioName.trim() || 'Nova Carteira Importada';
      targetId = addPortfolio(name, parsedData);
    } else {
      setPortfolioData(targetId, parsedData, importBehavior);
    }

    addHistoryEntry(parsedData.total_live);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setParsedData(null);
    setError(null);
  };

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#121316] border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Importar Planilha de Ativos</h2>
            <p className="text-xs text-white/50">Carregue dados do Excel diretamente para suas carteiras.</p>
          </div>
        </div>

        {/* Step 1: Upload Dropzone if no file loaded */}
        {!parsedData && !loading && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-white/15 hover:border-primary/50 bg-white/[0.02] hover:bg-primary/5 rounded-3xl cursor-pointer transition-all group">
              <div className="p-4 bg-white/5 group-hover:bg-primary/10 rounded-2xl mb-3 text-white/40 group-hover:text-primary transition-colors">
                <Upload size={32} />
              </div>
              <span className="text-sm font-bold text-white mb-1">Clique para selecionar o arquivo XLSX</span>
              <span className="text-xs text-white/40">Suporta relatórios B3 e planilhas estruturadas</span>
              <input type="file" className="hidden" accept=".xlsx" onChange={handleFileChange} />
            </label>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3 text-xs">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCcw className="animate-spin text-primary" size={36} />
            <p className="text-sm text-white/60 font-medium">Lendo e estruturando dados da planilha...</p>
          </div>
        )}

        {/* Step 2: Confirmation & Target Options */}
        {parsedData && !loading && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Parsed Summary Card */}
            <div className="p-5 bg-card border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-wider text-white/40">Resumo Encontrado</div>
                <button onClick={handleReset} className="text-xs text-primary hover:underline font-bold">
                  Trocar arquivo
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                <div className="p-2 bg-white/5 rounded-xl">
                  <div className="text-xs font-bold text-white">{parsedData.acoes.length}</div>
                  <div className="text-[10px] text-white/40">Ações</div>
                </div>
                <div className="p-2 bg-white/5 rounded-xl">
                  <div className="text-xs font-bold text-white">{parsedData.fiis.length}</div>
                  <div className="text-[10px] text-white/40">FIIs</div>
                </div>
                <div className="p-2 bg-white/5 rounded-xl">
                  <div className="text-xs font-bold text-white">{parsedData.tesouro.length}</div>
                  <div className="text-[10px] text-white/40">Tesouro</div>
                </div>
                <div className="p-2 bg-white/5 rounded-xl">
                  <div className="text-xs font-bold text-white">{parsedData.renda_fixa.length}</div>
                  <div className="text-[10px] text-white/40">Renda Fixa</div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs">
                <span className="text-white/60">Patrimônio Identificado:</span>
                <span className="font-black text-primary text-sm">{formatBRL(parsedData.total_live)}</span>
              </div>
            </div>

            {/* Target Portfolio Options */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-white/40 block">
                Destino da Importação
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetMode('existing')}
                  className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    targetMode === 'existing'
                      ? 'bg-primary/20 border-primary text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <Layers size={18} className={targetMode === 'existing' ? 'text-primary' : 'text-white/40'} />
                  <div>
                    <div className="text-xs font-bold">Carteira Existente</div>
                    <div className="text-[10px] opacity-60">Escolher uma lista atual</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetMode('new')}
                  className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    targetMode === 'new'
                      ? 'bg-primary/20 border-primary text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <Plus size={18} className={targetMode === 'new' ? 'text-primary' : 'text-white/40'} />
                  <div>
                    <div className="text-xs font-bold">Nova Carteira</div>
                    <div className="text-[10px] opacity-60">Criar uma carteira do zero</div>
                  </div>
                </button>
              </div>

              {targetMode === 'existing' ? (
                <div className="pt-2">
                  <select
                    value={selectedPortfolioId}
                    onChange={(e) => setSelectedPortfolioId(e.target.value)}
                    className="w-full bg-[#1a1c1e] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                  >
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#1a1c1e] text-white">
                        {p.name} ({formatBRL(p.data?.total_live)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="pt-2">
                  <input
                    type="text"
                    placeholder="Nome da nova carteira..."
                    value={newPortfolioName}
                    onChange={(e) => setNewPortfolioName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              )}
            </div>

            {/* Import Behavior (Replace vs Merge) */}
            {targetMode === 'existing' && (
              <div className="space-y-3 pt-2">
                <label className="text-xs font-black uppercase tracking-wider text-white/40 block">
                  Modo de Importação
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                    importBehavior === 'replace' ? 'bg-primary/20 border-primary text-white' : 'bg-white/5 border-white/10 text-white/60'
                  }`}>
                    <input
                      type="radio"
                      name="importBehavior"
                      value="replace"
                      checked={importBehavior === 'replace'}
                      onChange={() => setImportBehavior('replace')}
                      className="hidden"
                    />
                    <div className="w-4 h-4 rounded-full border border-white/40 flex items-center justify-center shrink-0">
                      {importBehavior === 'replace' && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold">Substituir Carteira</div>
                      <div className="text-[10px] text-white/40">Substitui os ativos antigos</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                    importBehavior === 'merge' ? 'bg-primary/20 border-primary text-white' : 'bg-white/5 border-white/10 text-white/60'
                  }`}>
                    <input
                      type="radio"
                      name="importBehavior"
                      value="merge"
                      checked={importBehavior === 'merge'}
                      onChange={() => setImportBehavior('merge')}
                      className="hidden"
                    />
                    <div className="w-4 h-4 rounded-full border border-white/40 flex items-center justify-center shrink-0">
                      {importBehavior === 'merge' && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold">Mesclar / Adicionar</div>
                      <div className="text-[10px] text-white/40">Soma posições existentes</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="flex-1 py-3.5 bg-primary hover:bg-primary/90 rounded-2xl text-white font-bold text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Confirmar Importação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
