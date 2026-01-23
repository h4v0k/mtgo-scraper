// Intelligent API URL: Runtime detection to be bulletproof
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// If VITE_API_URL is explicitly set (and not empty), use it. Otherwise adapt to environment.
const API_URL = import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:3001/api' : '/api');

export interface DeckSummary {
    id: number;
    player_name: string;
    event_name: string;
    event_date: string;
    rank: number;
    spice_count: number;
}

export interface Card {
    count: number;
    name: string;
    isSpice: boolean;
    frequency: number;
}

export interface DeckDetail {
    id: number;
    player_name: string;
    format: string;
    archetype_id: number;
    raw_decklist: string;
    cards: Card[];
    sideboard?: Card[];
    spice_cards?: string[];
}

export interface MetaData {
    archetype: string;
    count: number;
    total_decks: number;
}

// Helper to get token
const getToken = () => localStorage.getItem('spyglass_token');

export async function login(username: string, password: string) {
    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        throw new Error('Login failed');
    }

    return response.json();
}

export async function fetchMeta(format: string, days: number, top8: boolean, events: string[] = [], startDate?: string): Promise<MetaData[]> {
    const params = new URLSearchParams({
        format,
        days: days.toString(),
        top8: top8.toString(),
    });

    if (startDate) {
        params.append('startDate', startDate);
    }

    if (events && events.length > 0) {
        events.forEach(e => params.append('events', e));
    }

    const token = getToken();
    const response = await fetch(`${API_URL}/meta?${params}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized');
        }
        throw new Error('Failed to fetch meta data');
    }
    return response.json();
}

export async function fetchEvents(format: string, days: number, startDate?: string): Promise<string[]> {
    const params = new URLSearchParams({
        format,
        days: days.toString()
    });

    if (startDate) {
        params.append('startDate', startDate);
    }

    const token = getToken();
    const response = await fetch(`${API_URL}/events?${params}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        if (response.status === 401) throw new Error('Unauthorized');
        return [];
    }
    return response.json();
}

export async function fetchArchetypeDecks(name: string, format: string, days: number, top8: boolean, events: string[] = [], startDate?: string): Promise<DeckSummary[]> {
    const params = new URLSearchParams({
        format,
        days: days.toString(),
        top8: top8.toString()
    });

    if (startDate) {
        params.append('startDate', startDate);
    }

    if (events && events.length > 0) {
        events.forEach(e => params.append('events', e));
    }

    const token = getToken();
    const response = await fetch(`${API_URL}/meta/archetype/${encodeURIComponent(name)}?${params}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to fetch archetype decks');
    return response.json();
}

export async function fetchDeck(id: number): Promise<DeckDetail> {
    const token = getToken();
    const response = await fetch(`${API_URL}/deck/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to fetch deck');
    const data = await response.json();

    // Parse the lists locally using spice_cards info
    const parse = (list: string, spice: string[] = []) => {
        if (!list) return [];
        return list.split('\n')
            .map(l => l.trim())
            .filter(l => l)
            .map(l => {
                const parts = l.split(' ');
                const count = parseInt(parts[0]);
                const name = parts.slice(1).join(' ');
                return {
                    count: isNaN(count) ? 0 : count,
                    name,
                    isSpice: spice.includes(name),
                    frequency: 0 // Not needed for display
                };
            })
            .filter(c => c.count > 0);
    };

    return {
        ...data,
        cards: parse(data.raw_decklist, data.spice_cards),
        sideboard: parse(data.sideboard, data.spice_cards)
    };
}

export interface ConversionMetric {
    archetype: string;
    total_count: number;
    top8_count: number;
    wins_count: number;
    presence_pct: number;
    conversion_rate: number;
}

export async function fetchConversionMetrics(format: string, days: number): Promise<ConversionMetric[]> {
    const params = new URLSearchParams({
        format,
        days: days.toString()
    });

    const token = getToken();
    const response = await fetch(`${API_URL}/analytics/conversion?${params}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        if (response.status === 401) throw new Error('Unauthorized');
        throw new Error('Failed to fetch conversion metrics');
    }
    return response.json();
}

export interface LoginLog {
    id: number;
    username: string;
    ip_address: string;
    user_agent: string;
    login_timestamp: string;
}

export async function fetchLoginLogs(): Promise<LoginLog[]> {
    const token = getToken();
    const response = await fetch(`${API_URL}/admin/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json();
}

export async function fetchPlayerHistory(name: string, days: number = 30): Promise<any[]> {
    const token = getToken();
    const response = await fetch(`${API_URL}/player/${encodeURIComponent(name)}/history?days=${days}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to fetch player history');
    return response.json();
}

export async function fetchGoldfishHistory(name: string, days: number = 30): Promise<any[]> {
    const token = getToken();
    const response = await fetch(`${API_URL}/player/${encodeURIComponent(name)}/goldfish?days=${days}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    // If it fails (e.g. timeout or 500), return empty list so we don't break the UI
    if (!response.ok) {
        console.warn('Failed to fetch Goldfish history');
        return [];
    }
    return response.json();
}

export async function syncPlayer(name: string, days: number = 30): Promise<void> {
    const token = getToken();
    // Fire and forget, we don't await the result strictly for UI blocking, 
    // but here we just send the request.
    await fetch(`${API_URL}/player/${encodeURIComponent(name)}/sync`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ days })
    });
}

export async function searchPlayers(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const token = getToken();
    const response = await fetch(`${API_URL}/players/search?q=${encodeURIComponent(query)}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) return [];

    return response.json();
}
export async function searchCardNames(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const token = getToken();
    const response = await fetch(`${API_URL}/cards/search?q=${encodeURIComponent(query)}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) return [];

    return response.json();
}

export interface CardLookupResult {
    id: number;
    player_name: string;
    event_name: string;
    event_date: string;
    rank: number;
    format: string;
    archetype: string;
    spice_count: number;
    card_count: number;
}

export async function fetchDecksByCard(cardName: string, format: string, days: string): Promise<CardLookupResult[]> {
    const params = new URLSearchParams({
        card: cardName,
        format: format,
        days: days
    });

    const token = getToken();
    const response = await fetch(`${API_URL}/cards/lookup?${params}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) throw new Error('Failed to fetch decks by card');
    return response.json();
}
