import React, { useState, useMemo } from 'react';
import { InstallmentDetail } from '../../types/financing';
import {
  Table,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  installments: InstallmentDetail[];
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

export const InstallmentsTable: React.FC<Props> = ({ installments }) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('monthly');
  const [searchMonth, setSearchMonth] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const [onlyExtras, setOnlyExtras] = useState(false);

  // Agrupamento anual
  const annualData = useMemo(() => {
    const years: Record<number, {
      year: number;
      startMonth: number;
      endMonth: number;
      totalInstallment: number;
      regularAmortization: number;
      extraAmortization: number;
      interest: number;
      insuranceAndFees: number;
      totalOutflow: number;
      endingBalance: number;
      borrowerAge: number;
    }> = {};

    installments.forEach((inst) => {
      const yearNum = Math.ceil(inst.month / 12);
      if (!years[yearNum]) {
        years[yearNum] = {
          year: yearNum,
          startMonth: inst.month,
          endMonth: inst.month,
          totalInstallment: 0,
          regularAmortization: 0,
          extraAmortization: 0,
          interest: 0,
          insuranceAndFees: 0,
          totalOutflow: 0,
          endingBalance: inst.closingBalance,
          borrowerAge: inst.borrowerAge
        };
      }

      years[yearNum].endMonth = inst.month;
      years[yearNum].totalInstallment += inst.totalInstallment;
      years[yearNum].regularAmortization += inst.regularAmortization;
      years[yearNum].extraAmortization += inst.extraAmortization;
      years[yearNum].interest += inst.interest;
      years[yearNum].insuranceAndFees += inst.totalInsuranceAndFees;
      years[yearNum].totalOutflow += inst.totalOutflow;
      years[yearNum].endingBalance = inst.closingBalance;
      years[yearNum].borrowerAge = inst.borrowerAge;
    });

    return Object.values(years);
  }, [installments]);

  // Filtragem mensal
  const filteredMonthly = useMemo(() => {
    return installments.filter((item) => {
      if (onlyExtras && item.extraAmortization <= 0) return false;
      if (searchMonth) {
        const monthMatch = item.month.toString().includes(searchMonth);
        const yearMatch = Math.ceil(item.month / 12).toString().includes(searchMonth);
        return monthMatch || yearMatch;
      }
      return true;
    });
  }, [installments, onlyExtras, searchMonth]);

  const totalPages = Math.ceil(filteredMonthly.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedMonthly = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMonthly.slice(start, start + pageSize);
  }, [filteredMonthly, currentPage, pageSize]);

  // Função para exportar para Excel
  const handleExportExcel = () => {
    const worksheetData = installments.map((inst) => ({
      Mês: inst.month,
      Ano: Math.ceil(inst.month / 12),
      'Idade do Mutuário': inst.borrowerAge,
      'Saldo Devedor Inicial': inst.openingBalance,
      'Correção Monetária': inst.indexerAdjustment,
      'Saldo Recomposto': inst.adjustedBalance,
      'Amortização Ordinária': inst.regularAmortization,
      'Amortização Extra': inst.extraAmortization,
      Juros: inst.interest,
      'Seguro MIP': inst.mipInsurance,
      'Seguro DFI': inst.dfiInsurance,
      'Tarifa TCA': inst.adminFee,
      'Encargo Mensal': inst.totalInstallment,
      'Desembolso Total': inst.totalOutflow,
      'Saldo Devedor Final': inst.closingBalance
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronograma Financiamento');

    const fileName = `cronograma-financiamento-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-4">
      {/* Header & Filtros */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Table size={18} className="text-primary" />
          <div>
            <h3 className="font-bold text-sm text-white">Cronograma Detalhado de Parcelas</h3>
            <p className="text-[10px] text-white/40">
              {installments.length} parcelas calculadas com base nas diretrizes do BACEN e Súmula 450 do STJ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
          {/* Alternador Visão Mensal vs Anual */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'monthly'
                  ? 'bg-primary text-black font-black shadow-md shadow-primary/20'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Mês a Mês
            </button>
            <button
              type="button"
              onClick={() => setViewMode('annual')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'annual'
                  ? 'bg-primary text-black font-black shadow-md shadow-primary/20'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Consolidado Ano
            </button>
          </div>

          {/* Botão Exportar Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <Download size={14} className="text-primary" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Controles de Busca e Filtro na Visão Mensal */}
      {viewMode === 'monthly' && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="relative w-44">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Buscar mês ou ano..."
                value={searchMonth}
                onChange={(e) => {
                  setSearchMonth(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/20 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setOnlyExtras(!onlyExtras);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                onlyExtras
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
              }`}
            >
              <Zap size={13} />
              <span>Apenas c/ Amortização Extra</span>
            </button>
          </div>

          {/* Paginação */}
          <div className="flex items-center gap-2 text-white/40">
            <span>
              Página {currentPage} de {totalPages} ({filteredMonthly.length} itens)
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Dados */}
      <div className="overflow-x-auto custom-scrollbar border border-white/5 rounded-xl">
        <table className="w-full text-left text-xs text-white/70">
          <thead className="bg-white/5 uppercase text-[10px] font-black tracking-wider text-white/40 border-b border-white/10">
            <tr>
              {viewMode === 'monthly' ? (
                <>
                  <th className="py-2.5 px-3">Mês</th>
                  <th className="py-2.5 px-3">Idade</th>
                  <th className="py-2.5 px-3">Saldo Recomposto</th>
                  <th className="py-2.5 px-3">Encargo Mensal</th>
                  <th className="py-2.5 px-3">Amortização</th>
                  <th className="py-2.5 px-3">Juros</th>
                  <th className="py-2.5 px-3">Seguros & Taxas</th>
                  <th className="py-2.5 px-3 text-amber-400">Aporte Extra</th>
                  <th className="py-2.5 px-3 text-right">Saldo Final</th>
                </>
              ) : (
                <>
                  <th className="py-2.5 px-3">Ano</th>
                  <th className="py-2.5 px-3">Idade</th>
                  <th className="py-2.5 px-3">Total de Encargos</th>
                  <th className="py-2.5 px-3">Amortização Anual</th>
                  <th className="py-2.5 px-3">Juros Anuais</th>
                  <th className="py-2.5 px-3">Seguros & Taxas</th>
                  <th className="py-2.5 px-3 text-amber-400">Aportes Extras</th>
                  <th className="py-2.5 px-3 text-sky-400">Total Desembolsado</th>
                  <th className="py-2.5 px-3 text-right">Saldo Final do Ano</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {viewMode === 'monthly' ? (
              paginatedMonthly.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-white/30 font-sans">
                    Nenhuma parcela encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedMonthly.map((inst) => {
                  const hasExtra = inst.extraAmortization > 0;
                  return (
                    <tr
                      key={inst.month}
                      className={`hover:bg-white/5 transition-colors ${
                        hasExtra ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-sans font-bold text-white flex items-center gap-1.5">
                        <span>{inst.month}</span>
                        {hasExtra && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Possui amortização extraordinária" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-white/50">{inst.borrowerAge}a</td>
                      <td className="py-2.5 px-3 text-white/60">{formatCurrency(inst.adjustedBalance)}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{formatCurrency(inst.totalInstallment)}</td>
                      <td className="py-2.5 px-3 text-emerald-400">{formatCurrency(inst.regularAmortization)}</td>
                      <td className="py-2.5 px-3 text-rose-400">{formatCurrency(inst.interest)}</td>
                      <td className="py-2.5 px-3 text-sky-400">{formatCurrency(inst.totalInsuranceAndFees)}</td>
                      <td className="py-2.5 px-3 font-bold text-amber-400">
                        {hasExtra ? formatCurrency(inst.extraAmortization) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">
                        {formatCurrency(inst.closingBalance)}
                      </td>
                    </tr>
                  );
                })
              )
            ) : (
              annualData.map((yr) => (
                <tr key={yr.year} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-sans font-bold text-white">
                    Ano {yr.year}{' '}
                    <span className="text-[10px] text-white/40 font-normal">
                      (mês {yr.startMonth}-{yr.endMonth})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-white/50">{yr.borrowerAge}a</td>
                  <td className="py-2.5 px-3 font-bold text-white">{formatCurrency(yr.totalInstallment)}</td>
                  <td className="py-2.5 px-3 text-emerald-400">{formatCurrency(yr.regularAmortization)}</td>
                  <td className="py-2.5 px-3 text-rose-400">{formatCurrency(yr.interest)}</td>
                  <td className="py-2.5 px-3 text-sky-400">{formatCurrency(yr.insuranceAndFees)}</td>
                  <td className="py-2.5 px-3 font-bold text-amber-400">
                    {yr.extraAmortization > 0 ? formatCurrency(yr.extraAmortization) : '-'}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-sky-400">{formatCurrency(yr.totalOutflow)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">{formatCurrency(yr.endingBalance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
