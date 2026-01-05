// Intelligent API URL: Use Env Var if set -> else localhost (Dev) -> else relative (Prod)
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

export interface DeckSummary {
    id: number;
    player_name: string;
    event_name: string;
    event_date: string;
    rank: number;
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
}

export interface MetaData {
    archetype: string;
    count: number;
    total_decks: number;
}

// Helper to get token
const getToken = () => localStorage.getItem('spyglass_token');

export async function fetchMeta(format: string, days: number, top8: boolean, events: string[] = []): Promise<MetaData[]> {
    const params = new URLSearchParams({
        format,
        days: days.toString(),
        top8: top8.toString(),
    });

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

export async function fetchEvents(format: string, days: number): Promise<string[]> {
    const params = new URLSearchParams({
        format,
        days: days.toString()
    });

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

export async function fetchArchetypeDecks(name: string, format: string, days: number, top8: boolean, events: string[] = []): Promise<DeckSummary[]> {
    const params = new URLSearchParams({
        format,
        days: days.toString(),
        top8: top8.toString()
    });

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
    return response.json();
}
