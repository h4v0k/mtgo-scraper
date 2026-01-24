

import { useState, useEffect } from 'react'
import './styles/variables.css'
import './App.css'
import logo from './assets/banner.jpg'
import { DashboardControls } from './components/Dashboard/Controls'
import { MetaTable } from './components/Dashboard/MetaTable'
import { ArchetypeView } from './components/Dashboard/ArchetypeView'
import { DeckView } from './components/Dashboard/DeckView'
import { Login } from './components/Login'
import { AdminPanel } from './components/Admin/AdminPanel';
import { ConversionMatrix } from './components/Analytics/ConversionMatrix'
import { Gameplay } from './components/Gameplay/Gameplay'
import { fetchMeta } from './services/api'
import type { MetaData } from './services/api'
import { CardLookup } from './components/CardLookup/CardLookup'
import { ChallengeView } from './components/Challenges/ChallengeView'
import { MaintenanceBanner } from './components/MaintenanceBanner'

const MAINTENANCE_MODE = true;

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('spyglass_token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('spyglass_username'));

  const isAdminPath = window.location.pathname === '/admin' || window.location.pathname === '/admin/';
  const isAdminDomain = window.location.hostname === 'mtgo-scraper-client-new.vercel.app' || window.location.hostname === 'localhost';

  const [activeTab, setActiveTab] = useState<'meta' | 'analytics' | 'gameplay' | 'admin' | 'cards' | 'challenges'>(
    (isAdminPath && isAdminDomain) ? 'admin' : 'meta'
  );
  const [showLogin, setShowLogin] = useState(isAdminPath && isAdminDomain);

  // Dashboard State
  const [format, setFormat] = useState('Standard');
  const [days, setDays] = useState(7);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [top8, setTop8] = useState(false);
  const [data, setData] = useState<MetaData[]>([]);
  const [loading, setLoading] = useState(false);

  // Navigation State
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);

  // Event Filter State
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  // Player Search State
  const [initialSearch, setInitialSearch] = useState<string>('');

  useEffect(() => {
    const handlePopState = () => {
      const isPath = window.location.pathname === '/admin' || window.location.pathname === '/admin/';
      const isAdm = isPath && isAdminDomain;
      setShowLogin(isAdm);
      if (isAdm) {
        setActiveTab('admin');
      } else if (activeTab === 'admin') {
        setActiveTab('meta');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAdminDomain, activeTab]);

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
    // Only fetch meta if we are at the root level
    if (selectedArchetype === null && selectedDeckId === null && activeTab === 'meta') {
      async function loadData() {
        setLoading(true);
        try {
          const result = await fetchMeta(format, days, top8, selectedEvents, startDate);
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
  }, [format, days, top8, selectedEvents, selectedArchetype, selectedDeckId, activeTab, startDate]);

  const handleLoginSuccess = (newToken: string, newUsername: string) => {
    setToken(newToken);
    setUsername(newUsername);
    setShowLogin(false);
    setActiveTab('admin');
  };

  const handleLogout = () => {
    setToken(null);
    setUsername(null);
    setActiveTab('meta');
    if (window.location.pathname.startsWith('/admin')) {
      window.history.replaceState({}, '', '/');
    }
  };

  const handlePlayerSearch = (name: string) => {
    setInitialSearch(name);
    setSelectedArchetype(null);
    setSelectedDeckId(null);
    setActiveTab('gameplay');
  };

  const renderDashboardContent = () => {
    // 1. Deck View
    if (selectedDeckId !== null) {
      return (
        <DeckView
          deckId={selectedDeckId}
          onBack={() => setSelectedDeckId(null)}
          onPlayerSearch={handlePlayerSearch}
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
          onPlayerSearch={handlePlayerSearch}
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
          onCustomDateChange={handleCustomDateChange}
          startDate={startDate}
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

  const handleCustomDateChange = (date: string) => {
    setStartDate(date);
    if (date) {
      setDays(0); // Only switch to custom mode if a date is actually selected
    }
  };

  if (showLogin && !token) {
    return (
      <div className="admin-gate">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <Login onLoginSuccess={handleLoginSuccess} />
          <button
            onClick={() => {
              setShowLogin(false);
              window.history.replaceState({}, '', '/');
            }}
            style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#888', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Back to Public View
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {MAINTENANCE_MODE && <MaintenanceBanner />}
      <div className="app-container">
        {/* Donation Banner - Fixed Top */}
        <div className="donation-banner" style={{
          backgroundColor: '#1f1f1f',
          color: '#e0e0e0',
          textAlign: 'center',
          padding: '0.6rem',
          fontSize: '0.9rem',
          borderBottom: '1px solid #333',
          width: '100%',
          boxSizing: 'border-box',
          display: 'block'
        }}>
          This project is self-funded. If you enjoy the application, <a href="https://paypal.me/mpr0317" target="_blank" rel="noopener noreferrer" style={{ color: '#88aaff', textDecoration: 'underline', fontWeight: 'bold' }}>feel free to donate</a>.
        </div>

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
              className={activeTab === 'gameplay' ? 'active' : ''}
              onClick={() => setActiveTab('gameplay')}
            >
              Player Lookup
            </button>
            <button
              className={activeTab === 'cards' ? 'active' : ''}
              onClick={() => {
                setActiveTab('cards');
                setSelectedArchetype(null);
                setSelectedDeckId(null);
              }}
            >
              Card Lookup
            </button>
            <button
              className={activeTab === 'challenges' ? 'active' : ''}
              onClick={() => {
                setActiveTab('challenges');
                setSelectedArchetype(null);
                setSelectedDeckId(null);
              }}
            >
              Daily Challenge Results
            </button>
            <button
              className={activeTab === 'analytics' ? 'active' : ''}
              onClick={() => setActiveTab('analytics')}
            >
              Advanced Analytics
            </button>
            {username === 'havok' && token && isAdminDomain && isAdminPath && (
              <button
                className={activeTab === 'admin' ? 'active' : ''}
                onClick={() => setActiveTab('admin')}
              >
                Admin
              </button>
            )}
            {token && (
              <button onClick={handleLogout} className="logout-btn">
                Logout ({username})
              </button>
            )}
          </nav>
        </header>

        <main className="content-area">
          {activeTab === 'meta' ? (
            <div className="dashboard-view">
              {renderDashboardContent()}
            </div>
          ) : activeTab === 'admin' ? (
            <AdminPanel />
          ) : activeTab === 'analytics' ? (
            <div className="analytics-view">
              <ConversionMatrix />
            </div>
          ) : activeTab === 'cards' ? (
            <CardLookup />
          ) : activeTab === 'challenges' ? (
            <ChallengeView />
          ) : (
            <Gameplay initialPlayerName={initialSearch} />
          )}
        </main>
        <footer className="app-footer">
          <p>
            For questions/comments/concerns, feature requests or feedback, contact me at <a href="mailto:reignofhavok@proton.me">reignofhavok@proton.me</a>
          </p>
        </footer>
      </div>
      )
}

      export default App
