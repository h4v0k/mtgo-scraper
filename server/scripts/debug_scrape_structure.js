const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    // Boros Energy Modern
    const url = 'https://www.mtggoldfish.com/archetype/modern-boros-energy#paper';
    console.log(`Fetching ${url}...`);

    const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(data);

    const targetCard = "Arena of Glory";
    console.log(`Searching for card containing: ${targetCard}...`);

    // Iterate to find
    let cardEl = null;
    $('.spoiler-card').each((i, el) => {
        const alt = $(el).find('img').attr('alt') || "";
        if (alt.includes(targetCard)) {
            cardEl = $(el);
            console.log(`Found: ${alt}`);
            return false; // break
        }
    });

    if (cardEl) {
        console.log("\n--- HTML Structure ---");
        console.log("Parent Tag:", cardEl.parent().prop('tagName'));
        console.log("Parent Class:", cardEl.parent().attr('class'));

        console.log("\n--- Previous Siblings of Parent ---");
        let prev = cardEl.parent().prev();
        for (let i = 0; i < 3; i++) {
            console.log(`[Prev ${i + 1}] Tag: ${prev.prop('tagName')} | Class: ${prev.attr('class')} | Text: ${prev.text().trim().substring(0, 50)}`);
            prev = prev.prev();
        }

        console.log("\n--- Grandparent ---");
        console.log("GP Tag:", cardEl.parent().parent().prop('tagName'));
        console.log("GP Class:", cardEl.parent().parent().attr('class'));
        console.log("GP Prev HTML:", cardEl.parent().parent().prev().prop('outerHTML').slice(0, 200));

    } else {
        console.log("Card NOT found via img alt.");
    }
}

test();
