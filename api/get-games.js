/**
 * Vercel Serverless Function: api/get-games.js
 * This is a standard Node.js function.
 * It reads game data from the Vercel KV store.
 */

import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    try {
        // --- 1. Fetch data from Vercel KV Store ---
        const games = await kv.get('todays-games');

        if (!games || (Array.isArray(games) && games.length === 0)) {
            // --- 2. Send 404 if no games are found ---
            return response.status(404).json({ 
                error: 'No game data is currently available. The cron job may not have run yet.' 
            });
        }

        // --- 3. Send the data to the front-end ---
        // Success! Send the array of game objects back to index.html
        response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
        return response.status(200).json(games);

    } catch (error) {
        // Log the error for Vercel debugging
        console.error('Error fetching from KV:', error);
        
        // --- 4. Send 500 on any other error ---
        return response.status(500).json({ 
            error: `Server Error: ${error.message}` 
        });
    }
}

