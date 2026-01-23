// Simple test to verify API endpoint works
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

async function testSync() {
    const playerName = 'test';
    const token = localStorage.getItem('auth_token');

    console.log('Testing sync endpoint...');
    console.log('API URL:', API_URL);
    console.log('Token:', token ? 'Present' : 'Missing');

    try {
        const response = await fetch(`${API_URL}/player/${playerName}/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days: 30 })
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        const data = await response.json();
        console.log('Response data:', data);
    } catch (err) {
        console.error('Request failed:', err);
    }
}

// Run test
testSync();
