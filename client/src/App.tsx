

import { useState, useEffect } from 'react'
import './styles/variables.css'
import './App.css'
import logo from './assets/banner.jpg'
import { DashboardControls } from './components/Dashboard/Controls'
import { MetaTable } from './components/Dashboard/MetaTable'
import { ArchetypeView } from './components/Dashboard/ArchetypeView'
import { DeckView } from './components/Dashboard/DeckView'
import { Login } from './components/Login'
import { AdminPanel } from './components/Admin/AdminPanel'
import { ConversionMatrix } from './components/Analytics/ConversionMatrix'
import { fetchMeta } from './services/api'
import type { MetaData } from './services/api'

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('spyglass_token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('spyglass_username'));

  const [activeTab, setActiveTab] = useState<'meta' | 'analytics' | 'admin'>('meta');

  // Dashboard State
  const [format, setFormat] = useState('Standard');
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
    if (token) {
      localStorage.setItem('spyglass_token', token);
    } else {
      localStorage.removeItem('spyglass_token');
    }
  }, [token]);

  useEffect(() => {
    if (username) {
      localStorage.setItem('spyglass_username', username);
    } else {
      localStorage.removeItem('spyglass_username');
    }
  }, [username]);

  useEffect(() => {
    // Only fetch meta if we are at the root level and logged in
    if (token && selectedArchetype === null && selectedDeckId === null && activeTab === 'meta') {
      async function loadData() {
        setLoading(true);
        try {
          const result = await fetchMeta(format, days, top8, selectedEvents);
          setData(result);
        } catch (err) {
          console.error(err);
          setData([]);
          if ((err as Error).message === 'Unauthorized') {
            setToken(null);
          }
        } finally {
          setLoading(false);
        }
      }
      loadData();
    }
  }, [format, days, top8, selectedEvents, selectedArchetype, selectedDeckId, token, activeTab]);

  const handleLoginSuccess = (newToken: string, newUsername: string) => {
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    setToken(null);
    setUsername(null);
    setActiveTab('meta');
  };

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

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <img src={logo} alt="Havok's Spyglass" className="banner-img" />
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
          <button
            className={activeTab === 'admin' ? 'active' : ''}
            onClick={() => setActiveTab('admin')}
          >
            Admin
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Logout ({username})
          </button>
        </nav>
      </header>

      <main className="content-area">
        {activeTab === 'meta' ? (
          <div className="dashboard-view">
            {renderDashboardContent()}
          </div>
        ) : activeTab === 'admin' ? (
          <AdminPanel />
        ) : (
          <div className="analytics-view">
            <ConversionMatrix />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
