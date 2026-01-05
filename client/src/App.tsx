

import { useState, useEffect } from 'react'
import './styles/variables.css'
import './App.css'
import logo from './assets/logo.jpg'
import { DashboardControls } from './components/Dashboard/Controls'
import { MetaTable } from './components/Dashboard/MetaTable'
import { ArchetypeView } from './components/Dashboard/ArchetypeView'
import { DeckView } from './components/Dashboard/DeckView'
import { fetchMeta } from './services/api'
import type { MetaData } from './services/api'

function App() {
  const [activeTab, setActiveTab] = useState<'meta' | 'analytics'>('meta');

  // Dashboard State
  const [format, setFormat] = useState('Modern');
  const [days, setDays] = useState(7);
  const [top8, setTop8] = useState(false);
  const [data, setData] = useState<MetaData[]>([]);
  const [loading, setLoading] = useState(false);

  // Navigation State
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);

  // Event Filter State
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  useEffect(() => {
    // Only fetch meta if we are at the root level
    if (selectedArchetype === null && selectedDeckId === null) {
      async function loadData() {
        setLoading(true);
        try {
          const result = await fetchMeta(format, days, top8, selectedEvents);
          setData(result);
        } catch (err) {
          console.error(err);
          setData([]);
        } finally {
          setLoading(false);
        }
      }
      loadData();
    }
  }, [format, days, top8, selectedEvents, selectedArchetype, selectedDeckId]);

  const renderDashboardContent = () => {
    // 1. Deck View
    if (selectedDeckId !== null) {
      return (
        <DeckView
          deckId={selectedDeckId}
          onBack={() => setSelectedDeckId(null)}
        />
      );
    }

    // 2. Archetype View
    if (selectedArchetype !== null) {
      return (
        <ArchetypeView
          archetype={selectedArchetype}
          format={format}
          days={days}
          top8={top8}
          selectedEvents={selectedEvents}
          onBack={() => setSelectedArchetype(null)}
          onSelectDeck={(id) => setSelectedDeckId(id)}
        />
      );
    }

    // 3. Meta Overview
    return (
      <>
        <DashboardControls
          format={format} setFormat={setFormat}
          days={days} setDays={setDays}
          top8={top8} setTop8={setTop8}
          selectedEvents={selectedEvents}
          setSelectedEvents={setSelectedEvents}
        />
        {loading ? (
          <div className="loading-state">Loading Arcane Knowledge...</div>
        ) : (
          <MetaTable
            data={data}
            onSelectArchetype={(arch) => setSelectedArchetype(arch)}
          />
        )}
      </>
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <img src={logo} alt="Havok's Spyglass" className="logo-img" />
          <div className="logo-text">HAVOK'S SPYGLASS</div>
        </div>
        <nav className="main-nav">
          <button
            className={activeTab === 'meta' ? 'active' : ''}
            onClick={() => {
              setActiveTab('meta');
              setSelectedArchetype(null);
              setSelectedDeckId(null);
            }}
          >
            Meta Analysis
          </button>
          <button
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            Advanced Analytics
          </button>
        </nav>
      </header>

      <main className="content-area">
        {activeTab === 'meta' ? (
          <div className="dashboard-view">
            {renderDashboardContent()}
          </div>
        ) : (
          <div className="analytics-view">
            <h1>Advanced Analytics</h1>
            <p>Coming Soon...</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
