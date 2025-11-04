/**
 * Vercel Serverless Function: api/get-games.js
 *
 * This function is called by the `index.html` page when a user loads it.
 * Its ONLY job is to read the pre-merged game data from the Vercel KV store.
 *
 * This version has been updated to use the `@vercel/kv` client
 * and has the 'runtime: edge' config removed to fix a Vercel build error.
 */

import { kv } from '@vercel/kv';

// !! CONFIG REMOVED !!
// The "export const config = { runtime: 'edge' };" line was here.
// Removing it forces Vercel to build this as a standard Node.js function,
// which correctly installs the '@vercel/kv' dependency.

export default async function handler(request) {
    try {
        // --- 1. Fetch data from Vercel KV Store using the client ---
        // 'todays-games' is the key we save to in update-games.js
        const games = await kv.get('todays-games');

        if (!games || (Array.isArray(games) && games.length === 0)) {
            // This is a valid case where the cron job ran but found no games
            if (Array.isArray(games) && games.length === 0) {
                return new Response(
                    JSON.stringify([]), // Return an empty array
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }

            // This case means the key truly doesn't exist
            return new Response(
                JSON.stringify({ error: 'No game data is currently available. The cron job may not have run yet.' }),
                {
                    status: 404, // Not Found
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // --- 2. Send the data to the front-end ---
        // Success! Send the array of game objects back to index.html
        return new Response(
            JSON.stringify(games),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 's-maxage=60, stale-while-revalidate=600' // Cache for 1 min
                },
            }
        );

    } catch (error) {
        // Log the error for Vercel debugging
        console.error('Error fetching from KV:', error);

        return new Response(
            JSON.stringify({ error: `Server Error: ${error.message}` }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}

