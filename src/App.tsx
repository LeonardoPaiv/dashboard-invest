import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Strategy } from './components/Strategy'
import { Projection } from './components/Projection'

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'strategy' | 'history' | 'projection'>('dashboard')

  return (
    <div className="flex min-h-screen bg-background text-white font-sans selection:bg-primary/30 selection:text-primary">
      {/* Sidebar - Fixa */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'strategy' && <Strategy />}
          {activeTab === 'projection' && <Projection />}
          {activeTab === 'history' && (
            <div className="p-8 text-center text-white/40">Funcionalidade de histórico será implementada em breve.</div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
