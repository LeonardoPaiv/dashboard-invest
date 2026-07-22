import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, FileSpreadsheet, Check, RefreshCcw, Plus, Layers, AlertCircle, Sliders } from 'lucide-react';
import { useInvestmentStore, PortfolioData } from '../store/useInvestmentStore';
import {
  parseRawFile,
  convertRowsToPortfolioData,
  convertAllSheetsToPortfolioData,
  DetectedFileStructure,
  ColumnMappingConfig
} from '../utils/universalParser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialFile?: File | null;
}

export const ImportModal: React.FC<Props> = ({ isOpen, onClose, initialFile }) => {
  const { portfolios, activePortfolioId, setPortfolioData, addPortfolio, addHistoryEntry, autoBuildImportSections } = useInvestmentStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileStructure, setFileStructure] = useState<DetectedFileStructure | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('Sheet1');
  const [mapping, setMapping] = useState<ColumnMappingConfig>({
    headerRowIndex: 0,
    tickerCol: 0,
    quantityCol: 1,
    priceCol: 2,
    categoryCol: null
  });

  const [step, setStep] = useState<1 | 2>(1);

  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('existing');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    activePortfolioId !== 'all' ? activePortfolioId : portfolios[0]?.id || 'default'
  );
  const [newPortfolioName, setNewPortfolioName] = useState<string>('');
  const [importBehavior, setImportBehavior] = useState<'replace' | 'merge'>('replace');

  const handleProcessFile = async (f: File) => {
    setLoading(true);
    setError(null);
    try {
      const structure = await parseRawFile(f);
      if (!structure.rows || structure.rows.length === 0) {
        setError('O arquivo selecionado está vazio ou não pôde ser lido.');
        setFileStructure(null);
      } else {
        setFileStructure(structure);
        setActiveSheet(structure.activeSheet);
        setMapping(structure.suggestedMapping);

        const baseName = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setNewPortfolioName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
        setStep(2);
      }
    } catch (err: any) {
      console.error('Error processing file:', err);
      setError('Erro ao ler o arquivo. Certifique-se de ser um arquivo .csv ou .xlsx válido.');
      setFileStructure(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialFile) {
      handleProcessFile(initialFile);
    }
  }, [initialFile]);

  const handleSheetChange = (sheetName: string) => {
    if (!fileStructure) return;
    setActiveSheet(sheetName);
  };

  const currentRows = useMemo(() => {
    if (!fileStructure) return [];
    return fileStructure.sheets[activeSheet] || fileStructure.rows || [];
  }, [fileStructure, activeSheet]);

  const maxColumns = useMemo(() => {
    if (!currentRows || currentRows.length === 0) return 0;
    return Math.max(...currentRows.slice(0, 10).map(r => (Array.isArray(r) ? r.length : 0)));
  }, [currentRows]);

  const previewColumnSamples = useMemo(() => {
    const samples: Record<number, string[]> = {};
    const startRow = mapping.headerRowIndex + 1;
    for (let c = 0; c < maxColumns; c++) {
      const colValues: string[] = [];
      for (let r = startRow; r < Math.min(currentRows.length, startRow + 5); r++) {
        const val = currentRows[r]?.[c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          colValues.push(String(val).trim());
        }
      }
      samples[c] = colValues;
    }
    return samples;
  }, [currentRows, maxColumns, mapping.headerRowIndex]);

  const parsedPortfolioData = useMemo<PortfolioData | null>(() => {
    if (!fileStructure) return null;
    if (activeSheet === 'all' && fileStructure.sheets) {
      return convertAllSheetsToPortfolioData(fileStructure.sheets);
    }
    if (!currentRows || currentRows.length === 0) return null;
    return convertRowsToPortfolioData(currentRows, mapping, activeSheet);
  }, [fileStructure, activeSheet, currentRows, mapping]);

  const totalAssetsCount = useMemo(() => {
    if (!parsedPortfolioData) return 0;
    return (
      parsedPortfolioData.acoes.length +
      parsedPortfolioData.fiis.length +
      parsedPortfolioData.tesouro.length +
      parsedPortfolioData.renda_fixa.length
    );
  }, [parsedPortfolioData]);

  const handleConfirmImport = () => {
    if (!parsedPortfolioData) return;

    let targetId = selectedPortfolioId;
    if (targetMode === 'new') {
      const name = newPortfolioName.trim() || 'Nova Carteira Importada';
      targetId = addPortfolio(name, parsedPortfolioData);
    } else {
      setPortfolioData(targetId, parsedPortfolioData, importBehavior);
    }

    addHistoryEntry(parsedPortfolioData.total_live);
    autoBuildImportSections(activeSheet, mapping, parsedPortfolioData);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFileStructure(null);
    setError(null);
    setStep(1);
  };

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#121316] border border-white/10 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Importação Universal de Ativos</h2>
              <p className="text-xs text-white/50">Aceita qualquer arquivo CSV ou XLSX com mapeamento dinâmico.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <RefreshCcw className="animate-spin text-primary" size={36} />
            <p className="text-sm text-white/60 font-medium">Processando e estruturando colunas do arquivo...</p>
          </div>
        )}

        {/* Step 1: Drag & Drop File Upload */}
        {step === 1 && !loading && (
          <div className="space-y-4 my-auto">
            <label className="flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed border-white/15 hover:border-primary/50 bg-white/[0.02] hover:bg-primary/5 rounded-3xl cursor-pointer transition-all group text-center">
              <div className="p-4 bg-white/5 group-hover:bg-primary/10 rounded-2xl mb-3 text-white/40 group-hover:text-primary transition-colors">
                <Upload size={32} />
              </div>
              <span className="text-sm font-bold text-white mb-1">Selecione ou arraste seu arquivo (.CSV ou .XLSX)</span>
              <span className="text-xs text-white/40 max-w-xs">
                Funciona com relatórios B3, StatusInvest, Kinvo, Gorila, XP, BTG ou planilhas pessoais.
              </span>
              <input
                type="file"
                className="hidden"
                accept=".csv, .xlsx, .xls, .txt"
                onChange={(e) => e.target.files?.[0] && handleProcessFile(e.target.files[0])}
              />
            </label>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3 text-xs">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Interactive Column Alignment & Live Asset Preview */}
        {step === 2 && fileStructure && !loading && (
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
            {/* Sheet Selector if multiple sheets */}
            {fileStructure.sheetNames.length > 1 && (
              <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-xs font-bold text-white/70">Aba da Planilha:</span>
                <select
                  value={activeSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="bg-[#1a1c1e] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-bold"
                >
                  <option value="all" className="bg-[#1a1c1e] text-white">
                    ✨ Todas as Abas (Consolidado - B3)
                  </option>
                  {fileStructure.sheetNames.map((s) => (
                    <option key={s} value={s} className="bg-[#1a1c1e] text-white">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Column Alignment Controls */}
            <div className="p-4 bg-card border border-white/10 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-white/50 flex items-center gap-2">
                  <Sliders size={14} className="text-primary" /> Mapeamento de Colunas
                </h3>
                <button onClick={handleReset} className="text-xs text-primary hover:underline font-bold">
                  Trocar arquivo
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Ticker Column */}
                <div>
                  <label className="text-[10px] font-black uppercase text-white/40 block mb-1">
                    Ticker / Ativo
                  </label>
                  <select
                    value={mapping.tickerCol}
                    onChange={(e) => setMapping({ ...mapping, tickerCol: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#1a1c1e] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {Array.from({ length: maxColumns }).map((_, idx) => {
                      const sample = previewColumnSamples[idx]?.slice(0, 2).join(', ');
                      return (
                        <option key={idx} value={idx} className="bg-[#1a1c1e] text-white">
                          Col {idx} {sample ? `(${sample})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Quantity Column */}
                <div>
                  <label className="text-[10px] font-black uppercase text-white/40 block mb-1">
                    Quantidade
                  </label>
                  <select
                    value={mapping.quantityCol}
                    onChange={(e) => setMapping({ ...mapping, quantityCol: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#1a1c1e] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {Array.from({ length: maxColumns }).map((_, idx) => {
                      const sample = previewColumnSamples[idx]?.slice(0, 2).join(', ');
                      return (
                        <option key={idx} value={idx} className="bg-[#1a1c1e] text-white">
                          Col {idx} {sample ? `(${sample})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Price Column */}
                <div>
                  <label className="text-[10px] font-black uppercase text-white/40 block mb-1">
                    Preço / Cotação
                  </label>
                  <select
                    value={mapping.priceCol}
                    onChange={(e) => setMapping({ ...mapping, priceCol: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#1a1c1e] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {Array.from({ length: maxColumns }).map((_, idx) => {
                      const sample = previewColumnSamples[idx]?.slice(0, 2).join(', ');
                      return (
                        <option key={idx} value={idx} className="bg-[#1a1c1e] text-white">
                          Col {idx} {sample ? `(${sample})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Category Column */}
                <div>
                  <label className="text-[10px] font-black uppercase text-white/40 block mb-1">
                    Categoria (Opcional)
                  </label>
                  <select
                    value={mapping.categoryCol ?? -1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setMapping({ ...mapping, categoryCol: val >= 0 ? val : null });
                    }}
                    className="w-full bg-[#1a1c1e] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    <option value={-1} className="bg-[#1a1c1e] text-white">Auto (Inteligente)</option>
                    {Array.from({ length: maxColumns }).map((_, idx) => {
                      const sample = previewColumnSamples[idx]?.slice(0, 2).join(', ');
                      return (
                        <option key={idx} value={idx} className="bg-[#1a1c1e] text-white">
                          Col {idx} {sample ? `(${sample})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Live Identified Asset Breakdown */}
            {parsedPortfolioData && (
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white/70">Ativos Identificados:</span>
                  <span className="font-black text-primary text-sm">
                    {totalAssetsCount} ativos ({formatBRL(parsedPortfolioData.total_live)})
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-white">{parsedPortfolioData.acoes.length}</div>
                    <div className="text-[10px] text-white/40">Ações</div>
                  </div>
                  <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-white">{parsedPortfolioData.fiis.length}</div>
                    <div className="text-[10px] text-white/40">FIIs</div>
                  </div>
                  <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-white">{parsedPortfolioData.tesouro.length}</div>
                    <div className="text-[10px] text-white/40">Tesouro</div>
                  </div>
                  <div className="p-2 bg-black/40 rounded-xl border border-white/5">
                    <div className="font-bold text-white">{parsedPortfolioData.renda_fixa.length}</div>
                    <div className="text-[10px] text-white/40">R. Fixa</div>
                  </div>
                </div>
              </div>
            )}

            {/* Destination Portfolio Section */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-white/40 block">
                Carteira Destino
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetMode('existing')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    targetMode === 'existing'
                      ? 'bg-primary/20 border-primary text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <Layers size={18} className={targetMode === 'existing' ? 'text-primary' : 'text-white/40'} />
                  <div>
                    <div className="text-xs font-bold">Carteira Existente</div>
                    <div className="text-[10px] opacity-60">Escolher uma atual</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetMode('new')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    targetMode === 'new'
                      ? 'bg-primary/20 border-primary text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <Plus size={18} className={targetMode === 'new' ? 'text-primary' : 'text-white/40'} />
                  <div>
                    <div className="text-xs font-bold">Nova Carteira</div>
                    <div className="text-[10px] opacity-60">Criar uma do zero</div>
                  </div>
                </button>
              </div>

              {targetMode === 'existing' ? (
                <div className="pt-1">
                  <select
                    value={selectedPortfolioId}
                    onChange={(e) => setSelectedPortfolioId(e.target.value)}
                    className="w-full bg-[#1a1c1e] border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary transition-all font-bold"
                  >
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#1a1c1e] text-white">
                        {p.name} ({formatBRL(p.data?.total_live)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="Nome da nova carteira..."
                    value={newPortfolioName}
                    onChange={(e) => setNewPortfolioName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary transition-all font-bold"
                  />
                </div>
              )}
            </div>

            {/* Import Behavior (Replace vs Merge) */}
            {targetMode === 'existing' && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-black uppercase tracking-wider text-white/40 block">
                  Modo de Importação
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                      importBehavior === 'replace'
                        ? 'bg-primary/20 border-primary text-white'
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}
                  >
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
                      <div className="text-xs font-bold">Substituir</div>
                      <div className="text-[10px] text-white/40">Substitui ativos atuais</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                      importBehavior === 'merge'
                        ? 'bg-primary/20 border-primary text-white'
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}
                  >
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
                      <div className="text-xs font-bold">Mesclar / Somar</div>
                      <div className="text-[10px] text-white/40">Soma com ativos atuais</div>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Actions Footer */}
        {step === 2 && !loading && (
          <div className="pt-3 border-t border-white/10 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-bold text-xs transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={totalAssetsCount === 0}
              onClick={handleConfirmImport}
              className={`flex-1 py-3 rounded-2xl text-white font-bold text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                totalAssetsCount > 0
                  ? 'bg-primary hover:bg-primary/90 shadow-primary/20'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <Check size={16} />
              Confirmar Importação ({totalAssetsCount})
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
