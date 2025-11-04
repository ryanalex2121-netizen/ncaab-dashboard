// This function is what your index.html fetches.
// It DOES NOT call The Odds API. It just reads from Vercel KV.
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    try {
        console.log("PAGE_LOAD: Fetching games from KV store...");
        
        // 1. Fetch the data from the KV store
        const mergedGameData = await kv.get('todays-games');

        // Check if data exists
        if (!mergedGameData) {
            console.warn("PAGE_LOAD: No data in KV store.");
            // This is a "soft" error. It just means the cron job hasn't run yet.
            return response.status(404).json({ error: "No game data is currently cached. The data-fetcher cron job may not have run yet. Please wait a few minutes and try again." });
        }
        
        if (mergedGameData.length === 0) {
            console.log("PAGE_LOAD: KV store has 0 games (likely no games scheduled or no AI projections matched).");
        }
        
        // 2. Return the cached data to the user
        response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); // 1 min cache
        response.status(200).json(mergedGameData);

    } catch (error) {
        console.error("PAGE_LOAD Error:", error.message);
        // This will catch errors if the KV store isn't connected
        response.status(500).json({ error: "Failed to read data from KV cache. Is the KV store connected to the project?" });
    }
}

