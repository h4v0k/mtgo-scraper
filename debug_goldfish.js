const fs = require('fs');

async function dumpDeck(url) {
    console.log(`Dumping HTML for: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.mtggoldfish.com/',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            console.error("Response not OK:", response.status);
            return;
        }

        const html = await response.text();
        fs.writeFileSync('server/goldfish_dump.html', html);
        console.log("Dumped to server/goldfish_dump.html");

    } catch (e) {
        console.error("Error:", e);
    }
}

// Valid deck URL
dumpDeck('https://www.mtggoldfish.com/deck/6134372#paper');
