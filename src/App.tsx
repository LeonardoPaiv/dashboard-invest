import { useInvestmentStore } from './store/useInvestmentStore'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Strategy } from './components/Strategy'
import { Projection } from './components/Projection'
import { PlanoMensal } from './components/PlanoMensal.tsx' 
import { ImportSettings } from './components/ImportSettings'
import { AveragePrice } from './components/AveragePrice'
import { TaxModule } from './components/TaxModule.tsx'
import { DataManagement } from './components/DataManagement.tsx'
import { History } from './components/History'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  const { activeTab, setActiveTab } = useInvestmentStore();

  return (
    <ErrorBoundary>
      <div className="flex flex-col md:flex-row h-screen h-[100dvh] bg-background text-white font-sans selection:bg-primary/30 selection:text-primary overflow-hidden">
        {/* Sidebar / Header Mobile */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-black/10 overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'strategy' && <Strategy />}
            {activeTab === 'projection' && <Projection />}
            {activeTab === 'plano-mensal' && <PlanoMensal setActiveTab={setActiveTab} />}
            {activeTab === 'settings' && <ImportSettings />}
            {activeTab === 'preco-medio' && <AveragePrice />}
            {activeTab === 'imposto-renda' && <TaxModule />}
            {activeTab === 'data-management' && <DataManagement />}
            {activeTab === 'history' && <History />}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
