const axios = require('axios');
const cheerio = require('cheerio');

async function debugEventStructure() {
    const TEST_URL = 'https://www.mtgtop8.com/format?f=MO';
    console.log('Fetching Format Page...');
    const { data: formatHtml } = await axios.get(TEST_URL);
    const $ = cheerio.load(formatHtml);

    let challengeUrl = null;
    $('a').each((i, el) => {
        const text = $(el).text();
        const href = $(el).attr('href');
        if (href && text.includes('Challenge') && !challengeUrl) {
            challengeUrl = 'https://www.mtgtop8.com/' + href;
        }
    });

    if (!challengeUrl) {
        console.log('No Challenge found.');
        return;
    }

    console.log(`Fetching Event Page: ${challengeUrl}`);
    const { data: eventHtml } = await axios.get(challengeUrl);
    const $e = cheerio.load(eventHtml);

    // Inspect potential keys containers
    console.log('--- Inspecting Hover TRs ---');
    const hoverTrs = $e('.hover_tr');
    console.log(`Found ${hoverTrs.length} elements with class .hover_tr`);

    hoverTrs.slice(0, 5).each((i, el) => {
        const text = $e(el).text().replace(/\s+/g, ' ').trim();
        const links = $e(el).find('a');
        console.log(`Row ${i}: Text="${text}" | LinkCount=${links.length}`);
        links.each((j, link) => {
            console.log(`   Link ${j}: ${$e(link).attr('href')} | "${$e(link).text()}"`);
        });
    });

    console.log('\n--- Inspecting Divs with class S14 ---');
    const s14s = $e('div.S14');
    console.log(`Found ${s14s.length} divs with class .S14`);
    s14s.slice(0, 5).each((i, el) => {
        console.log(`S14 ${i}: "${$e(el).text().trim()}"`);
    });
}

debugEventStructure();
