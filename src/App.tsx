import { useInvestmentStore } from './store/useInvestmentStore'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Strategy } from './components/Strategy'
import { Projection } from './components/Projection'
import { PlanoMensal } from './components/PlanoMensal.tsx' 
import { ImportSettings } from './components/ImportSettings'
import { AveragePrice } from './components/AveragePrice'
import { TaxModule } from './components/TaxModule'

function App() {
  const { activeTab, setActiveTab } = useInvestmentStore();

  return (
    <div className="flex min-h-screen bg-background text-white font-sans selection:bg-primary/30 selection:text-primary">
      {/* Sidebar - Fixa */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'strategy' && <Strategy />}
          {activeTab === 'projection' && <Projection />}
          {activeTab === 'plano-mensal' && <PlanoMensal setActiveTab={setActiveTab} />}
          {activeTab === 'settings' && <ImportSettings />}
          {activeTab === 'preco-medio' && <AveragePrice />}
          {activeTab === 'imposto-renda' && <TaxModule />}
          {activeTab === 'history' && (
            <div className="p-8 text-center text-white/40">Funcionalidade de histórico será implementada em breve.</div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
