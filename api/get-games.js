/**
 * Vercel Serverless Function: api/get-games.js
 * * This function is called by the `index.html` page when a user loads it.
 * Its ONLY job is to read the pre-merged game data from the Vercel KV store
 * (which is populated by the `api/update-games.js` cron job).
 * * This function does NOT call any external sports APIs.
 * This function has NO dependencies and does not need `npm install`.
 */

// We are not using `@vercel/kv` to avoid install errors.
// We will use the built-in `fetch` to talk to the KV store's REST API.

export const config = {
    runtime: 'edge', // Use the fast Edge runtime
};

export default async function handler(request) {
    // Get the Vercel-provided Environment Variables
    const KV_REST_API_URL = process.env.KV_REST_API_URL;
    const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
        return new Response(
            JSON.stringify({ error: 'KV store is not configured correctly. Check Environment Variables.' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    // Construct the URL to "get" our specific key
    // The command is "get" and the key is "todays-games"
    const url = `${KV_REST_API_URL}/get/todays-games`;

    try {
        // --- 1. Fetch data from Vercel KV Store ---
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
            },
        });

        if (!response.ok) {
            throw new Error(`KV Error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // `data.result` contains the JSON string we saved.
        // We need to parse it one more time to get the actual array.
        const games = JSON.parse(data.result);

        if (!games || games.length === 0) {
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
        
        // Check if the error is because the key doesn't exist yet
        if (error.message.includes('Unexpected token \'n\'') || error.message.includes('invalid json')) {
             return new Response(
                JSON.stringify({ error: 'No game data found. Please run the /api/update-games cron job first.' }),
                {
                    status: 404, 
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }
        
        return new Response(
            JSON.stringify({ error: `Server Error: ${error.message}` }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
