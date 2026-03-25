import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useInvestmentStore, SectionConfig, ColumnMapping } from '../store/useInvestmentStore';
import { Plus, Trash2, Settings2, FileSpreadsheet, Upload, X, HelpCircle, Info } from 'lucide-react';

export const ImportSettings = () => {
  const { importConfig, setImportConfig } = useInvestmentStore();
  const [previewData, setPreviewData] = useState<any[][] | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

  const handleUpdateSection = (id: string, updates: Partial<SectionConfig>) => {
    setImportConfig({
      ...importConfig,
      sections: importConfig.sections.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  const handleUpdateMapping = (id: string, field: keyof ColumnMapping, value: number | null) => {
    setImportConfig({
      ...importConfig,
      sections: importConfig.sections.map(s => 
        s.id === id ? { ...s, mapping: { ...s.mapping, [field]: value } } : s
      )
    });
  };

  const addSection = () => {
    const newId = crypto.randomUUID();
    setImportConfig({
      ...importConfig,
      sections: [...importConfig.sections, {
        id: newId,
        name: 'Nova Seção',
        trigger: 'Texto Gatilho',
        type: 'acoes',
        mapping: { ticker: 0, position: 1, allocation: 2, price: 3, quantity: 4 }
      }]
    });
  };

  const removeSection = (id: string) => {
    setImportConfig({
      ...importConfig,
      sections: importConfig.sections.filter(s => s.id !== id)
    });
  };

  const handlePreviewUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        const firstSheet = wb.SheetNames[0];
        setCurrentSheet(firstSheet);
        
        const ws = wb.Sheets[firstSheet];
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        setPreviewData(data);
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    if (workbook) {
      setCurrentSheet(sheetName);
      const ws = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
      setPreviewData(data);
    }
  };

  // Calculate the maximum number of columns across all rows
  const maxCols = useMemo(() => {
    if (!previewData) return 0;
    return Math.max(...previewData.map(row => (row ? row.length : 0)));
  }, [previewData]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Side: Config Form (50%) */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar border-r border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Settings2 className="text-primary" />
              Configuração de Importação
            </h1>
            <p className="text-white/40 mt-1">Personalize como o sistema interpreta seu arquivo Excel.</p>
          </div>
          <button 
            onClick={addSection}
            className="flex items-center gap-2 px-6 py-3 bg-primary rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            Nova Seção
          </button>
        </div>

        <section className="bg-primary/5 border border-primary/20 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <HelpCircle size={80} />
          </div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Info className="text-primary" size={20} />
            Como configurar?
          </h2>
          <div className="space-y-3 text-sm text-white/70 relative z-10">
            <p><strong className="text-white">1. Visualize:</strong> Carregue seu arquivo XLSX no painel à direita.</p>
            <p><strong className="text-white">2. Gatilhos:</strong> Informe o texto exato de uma célula que inicia uma tabela (ex: "Fundos Listados").</p>
            <p><strong className="text-white">3. Mapeie:</strong> Use os números das <span className="text-primary font-bold">colunas</span> indicados no visualizador correspondentes a cada campo.</p>
          </div>
        </section>

        <div className="space-y-6">
          <h2 className="text-xl font-bold">Mapeamento de Tabelas</h2>
          <div className="flex flex-col gap-6 pb-20">
            {importConfig.sections.map((section) => (
              <div key={section.id} className="bg-card border border-white/10 rounded-3xl p-6 space-y-6 relative group">
                <button 
                  onClick={() => removeSection(section.id)}
                  className="absolute top-4 right-4 p-2 text-white/20 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputGroup 
                    label="Nome da Seção" 
                    type="text"
                    value={section.name} 
                    onChangeText={(v) => handleUpdateSection(section.id, { name: v })} 
                  />
                  <InputGroup 
                    label="Planilha (Aba)" 
                    type="text"
                    value={section.sheetName || ''} 
                    onChangeText={(v) => handleUpdateSection(section.id, { sheetName: v })} 
                    helper="Nome da aba no Excel para esta seção"
                    suggestions={sheetNames}
                  />
                  <InputGroup 
                    label="Texto Gatilho (Trigger)" 
                    type="text"
                    value={section.trigger} 
                    onChangeText={(v) => handleUpdateSection(section.id, { trigger: v })} 
                    helper="Célula que marca o início desta tabela"
                  />
                  <div className="col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Tipo de Ativo</label>
                    <select 
                      value={section.type}
                      onChange={(e) => handleUpdateSection(section.id, { type: e.target.value as any })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                    >
                      <option value="acoes">Ações</option>
                      <option value="fiis">FIIs</option>
                      <option value="tesouro">Tesouro Direto</option>
                      <option value="renda_fixa">Renda Fixa</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  {(section.type === 'acoes' || section.type === 'fiis') && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <MappingInput label="Ticker/Nome" value={section.mapping.ticker} onChange={(v) => handleUpdateMapping(section.id, 'ticker', v)} />
                      <MappingInput label="Quantidade" value={section.mapping.quantity} onChange={(v) => handleUpdateMapping(section.id, 'quantity', v)} />
                      <MappingInput label="Preço Unit." value={section.mapping.price} onChange={(v) => handleUpdateMapping(section.id, 'price', v)} />
                      <MappingInput label="Preço Médio" value={section.mapping.avgPrice || null} onChange={(v) => handleUpdateMapping(section.id, 'avgPrice', v)} />
                    </div>
                  )}

                  {section.type === 'renda_fixa' && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <MappingInput label="Produto" value={section.mapping.ticker} onChange={(v) => handleUpdateMapping(section.id, 'ticker', v)} />
                      <MappingInput label="Quantidade" value={section.mapping.quantity} onChange={(v) => handleUpdateMapping(section.id, 'quantity', v)} />
                      <MappingInput label="Valor Unit." value={section.mapping.price} onChange={(v) => handleUpdateMapping(section.id, 'price', v)} />
                      <MappingInput label="Indexador" value={section.mapping.indexador || null} onChange={(v) => handleUpdateMapping(section.id, 'indexador', v)} />
                      <MappingInput label="Vencimento" value={section.mapping.extra || null} onChange={(v) => handleUpdateMapping(section.id, 'extra', v)} />
                    </div>
                  )}

                  {section.type === 'tesouro' && (
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                      <MappingInput label="Produto" value={section.mapping.ticker} onChange={(v) => handleUpdateMapping(section.id, 'ticker', v)} />
                      <MappingInput label="Quantidade" value={section.mapping.quantity} onChange={(v) => handleUpdateMapping(section.id, 'quantity', v)} />
                      <MappingInput label="Valor Aplic." value={section.mapping.avgPrice || null} onChange={(v) => handleUpdateMapping(section.id, 'avgPrice', v)} />
                      <MappingInput label="Valor Bruto" value={section.mapping.grossValue || null} onChange={(v) => handleUpdateMapping(section.id, 'grossValue', v)} />
                      <MappingInput label="Valor Liq." value={section.mapping.netValue || null} onChange={(v) => handleUpdateMapping(section.id, 'netValue', v)} />
                      <MappingInput label="Vencimento" value={section.mapping.extra || null} onChange={(v) => handleUpdateMapping(section.id, 'extra', v)} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side: Preview (50%) */}
      <div className="flex-1 bg-[#0a0a0b] flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-card/30 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-primary" />
              <h3 className="font-bold">Visualizador XLSX</h3>
            </div>
            {sheetNames.length > 0 && (
              <select 
                value={currentSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs font-bold focus:outline-none focus:border-primary transition-all"
              >
                {sheetNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
          </div>
          {previewData && (
            <button 
              onClick={() => {
                setPreviewData(null);
                setSheetNames([]);
                setWorkbook(null);
              }}
              className="p-2 hover:bg-white/5 rounded-lg transition-all"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-hidden relative">
          {!previewData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
                <Upload className="text-primary" size={32} />
              </div>
              <h4 className="text-xl font-bold mb-2">Carregue sua planilha</h4>
              <p className="text-white/40 text-sm mb-8">Role os dados para conferir os índices das células.</p>
              
              <label className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 cursor-pointer transition-all">
                Selecionar Arquivo
                <input type="file" accept=".xlsx" className="hidden" onChange={handlePreviewUpload} />
              </label>
            </div>
          ) : (
            <div className="h-full overflow-auto custom-scrollbar">
              <table className="border-collapse w-full text-[11px] font-mono table-fixed min-w-full">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="bg-primary p-2 border border-white/10 text-white text-center w-12 sticky left-0 z-20">#</th>
                    {Array.from({ length: maxCols }).map((_, idx) => (
                      <th key={idx} className="bg-white/5 p-2 border border-white/10 text-white/40 font-bold min-w-[120px]">
                        Coluna {idx}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-primary/5 transition-colors group">
                      <td className="bg-white/10 p-2 border border-white/10 text-white/50 text-center font-bold sticky left-0 z-10 group-hover:text-primary transition-colors">
                        {rowIdx}
                      </td>
                      {Array.from({ length: maxCols }).map((_, cellIdx) => (
                        <td 
                          key={cellIdx} 
                          title={`Coluna ${cellIdx}`}
                          className="p-2 border border-white/5 text-white/40 truncate hover:text-white transition-colors cursor-help"
                        >
                          {row && row[cellIdx] !== undefined && row[cellIdx] !== null ? String(row[cellIdx]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-primary/5 border-t border-white/5">
           <div className="flex items-center gap-3">
             <Info size={14} className="text-primary shrink-0" />
             <p className="text-[10px] text-white/40 leading-relaxed font-medium">
               Passe o mouse sobre as células para ver o número da coluna. Use as <span className="text-primary">colunas (topo)</span> e <span className="text-primary">linhas (laterais)</span> para o mapeamento.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

const InputGroup = ({ label, value, onChange, onChangeText, type = 'number', helper, suggestions }: { label: string, value: any, onChange?: (v: number) => void, onChangeText?: (v: string) => void, type?: string, helper?: string, suggestions?: string[] }) => {
  const listId = useMemo(() => `list-${crypto.randomUUID()}`, []);
  
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => type === 'number' ? onChange?.(parseInt(e.target.value) || 0) : onChangeText?.(e.target.value)}
        list={suggestions ? listId : undefined}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-all text-sm"
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
      {helper && <span className="text-[9px] text-white/20 mt-1 block px-1">{helper}</span>}
    </div>
  );
};

const MappingInput = ({ label, value, onChange }: { label: string, value: number | null, onChange: (v: number | null) => void }) => (
  <div>
    <label className="text-[9px] font-bold uppercase text-white/30 block mb-1 truncate">{label}</label>
    <div className="flex gap-1">
      <input 
        type="number" 
        value={value === null ? '' : value} 
        onChange={(e) => onChange(e.target.value === '' ? null : (parseInt(e.target.value) || 0))}
        placeholder="-"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-center text-sm focus:outline-none focus:border-primary transition-all"
      />
    </div>
  </div>
);
