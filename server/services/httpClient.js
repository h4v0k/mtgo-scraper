const axios = require('axios');

// Rotate User-Agents to mimic real traffic
const USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0'
];

/**
 * Get a random User-Agent
 */
function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Distributed HTTP Client
 * Wraps axios to transparently handle Proxies or Scraper APIs.
 */
class HttpClient {
    constructor() {
        this.apiKey = process.env.SCRAPER_API_KEY;
        this.serviceUrl = process.env.SCRAPER_SERVICE_URL;

        // Secondary Proxy (e.g. ScrapeOps) for Player Search
        this.apiKey2 = process.env.SCRAPER_API_KEY_2;
        this.serviceUrl2 = process.env.SCRAPER_SERVICE_URL_2;
    }

    /**
     * Perform a GET request.
     * @param {string} url - The target URL.
     * @param {Object} options - { headers: {}, params: {}, forceProxy: boolean, useSecondary: boolean }
     */
    async get(url, options = {}) {
        const useSecondary = options.useSecondary && !!this.apiKey2;
        const usePrimary = !!this.apiKey && (options.forceProxy || process.env.USE_PROXY === 'true');

        const useProxy = useSecondary || usePrimary;

        try {
            if (useProxy) {
                return await this._requestViaProxy(url, options, useSecondary);
            } else {
                return await this._requestDirect(url, options);
            }
        } catch (error) {
            console.warn(`[HttpClient] Request failed for ${url}: ${error.message}`);
            throw error;
        }
    }

    async _requestDirect(url, options) {
        // console.log(`[HttpClient] Direct: ${url}`);
        const headers = {
            'User-Agent': getRandomUserAgent(),
            ...options.headers
        };

        return axios.get(url, { ...options, headers });
    }

    async _requestViaProxy(url, options, useSecondary = false) {
        // console.log(`[HttpClient] Proxy (Secondary=${useSecondary}): ${url}`);

        let currentKey = useSecondary ? this.apiKey2 : this.apiKey;
        let currentServiceUrl = useSecondary ? this.serviceUrl2 : this.serviceUrl;

        // Default param name
        let keyParam = 'api_key';

        // Auto-detect for Rayobyte/Scraping Robot (Primary)
        if (!useSecondary && !process.env.SCRAPER_PARAM_NAME && currentServiceUrl && currentServiceUrl.includes('scrapingrobot')) {
            keyParam = 'token';
        }

        // Auto-detect for ScrapeOps (Secondary) - usually 'api_key' but let's be safe
        if (useSecondary && currentServiceUrl && currentServiceUrl.includes('scrapeops')) {
            keyParam = 'api_key'; // Explicitly redundant but clear
        }

        const params = {
            [keyParam]: currentKey,
            url: url,
            ...options.params
        };

        if (options.render) params.render = 'true';

        // Ensure serviceUrl is defined
        if (!currentServiceUrl) {
            throw new Error(`Proxy configuration missing for ${useSecondary ? 'Secondary' : 'Primary'} proxy.`);
        }

        const res = await axios.get(currentServiceUrl, { params });

        // Unwrap Scraping Robot JSON (Primary Only)
        // Rayobyte returns { result: "<html>..." }
        // ScrapeOps validates and returns raw HTML usually (or checks docs)
        // We assume Secondary doesn't need unwrapping unless we see similar patterns
        if (!useSecondary && res.data && res.data.result && typeof res.data.result === 'string') {
            res.data = res.data.result;
        }

        return res;
    }
}

module.exports = new HttpClient();
