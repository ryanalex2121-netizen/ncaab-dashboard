// --- SERVERLESS FUNCTION ---
// This file will live at `/api/get-games.js`

// --- STEP 1: READ THE API KEY FROM VERCEL'S ENVIRONMENT VARIABLES ---
// We no longer hard-code the key. Vercel will inject it here.
// Make sure you add `API_SPORTS_KEY` to your Vercel Project Settings.
const API_SPORTS_KEY = process.env.API_SPORTS_KEY;
const API_SPORTS_HOST = 'v1.basketball.api-sports.io';

// --- GET TODAY'S DATE (YYYY-MM-DD format) ---
// This automatically gets today's date.
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const apiDate = `${year}-${month}-${day}`; // e.g., 2025-11-03
// const season = `${year}-${year + 1}`;     // e.g., 2025-2026 // OLD
const season = `${year}`; // e.g., 2025 --- Let's test if the API uses a single year for the season

// API-Sports League ID for NCAAB is 886
const SPREAD_URL = `https://${API_SPORTS_HOST}/odds?league=886&season=${season}&date=${apiDate}&bet=2`;
const TOTAL_URL = `https://${API_SPORTS_HOST}/odds?league=886&season=${season}&date=${apiDate}&bet=5`;


// --- !! IMPORTANT: DAILY UPDATE REQUIRED !! ---
// This list MUST be updated with your AI's projections for TODAY'S games.
// The names MUST match the names from the API.
// Use the Vercel logs to see the names the API is sending.
const aiProjections = [
    // --- EXAMPLE FOR TODAY (Nov 3, 2025) ---
    // You must find the real team names from the API logs and update this list.
    // {
    //     id: 1, 
    //     team1: "Duke", // This must match the API's "away" team name
    //     team2: "Kentucky",   // This must match the API's "home" team name
    //     projectedScore: { team1: 78, team2: 75 }, 
    //     analysis: "AI projects a tight game, favoring Duke to cover..."
    // },
    // {
    //     id: 2, 
    //     team1: "Kansas", // This must match the API's "away" team name
    //     team2: "Michigan St",   // This must match the API's "home" team name
    //     projectedScore: { team1: 82, team2: 70 }, 
    //     analysis: "AI finds strong value on Kansas..."
    // }

    // --- Your old mock data (will not match today's games) ---
    {
        id: 1, team1: "Louisville", team2: "SC State",
        projectedScore: { team1: 85, team2: 63 }, 
        analysis: "Mock data..."
    },
    {
        id: 2, team1: "Auburn", team2: "Bethune-Cookman",
        projectedScore: { team1: 90, team2: 57 },
        analysis: "Mock data..."
    },
    // ...etc
];

// This is the main serverless function handler.
export default async function handler(request, response) {
    
    if (!API_SPORTS_KEY) {
        return response.status(500).json({ error: "API key is not configured." });
    }

    try {
        // --- Step 1: Fetch Live Data from API-Sports ---
        const apiHeaders = {
            "x-apisports-key": API_SPORTS_KEY,
            "x-apisports-host": API_SPORTS_HOST
        };

        const [spreadResponse, totalResponse] = await Promise.all([
            fetch(SPREAD_URL, { headers: apiHeaders }),
            fetch(TOTAL_URL, { headers: apiHeaders })
        ]);

        if (!spreadResponse.ok || !totalResponse.ok) {
            throw new Error(`API-Sports Error: ${spreadResponse.status} / ${totalResponse.status}`);
        }

        const spreadData = await spreadResponse.json();
        const totalData = await totalResponse.json();

        // Check for API errors
        if (spreadData.errors?.token || totalData.errors?.token) {
             throw new Error("API Key is invalid or not authorized.");
        }
        if (!spreadData.response || !totalData.response) {
            throw new Error("Invalid data structure received from API-Sports.");
        }

        // --- !! DEBUGGING STEP !! ---
        // This will log the exact team names to your Vercel console.
        console.log("--- API-SPORTS TEAM NAMES FOR TODAY ---");
        spreadData.response.forEach(game => {
            console.log(`AWAY: ${game.game.teams.away.name} | HOME: ${game.game.teams.home.name}`);
        });
        console.log("-----------------------------------------");


        // --- Step 2: Merge API Data with AI Projections ---
        const mergedGameData = mergeAPIData(aiProjections, spreadData.response, totalData.response);
        
        // --- Step 3: Return the merged data as JSON ---
        response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate'); // 15 min cache
        response.status(200).json(mergedGameData);

    } catch (error) {
        console.error("Serverless function error:", error);
        response.status(500).json({ error: error.message });
    }
}

/**
 * Merge logic
 */
function mergeAPIData(aiData, apiSpreads, apiTotals) {
    const finalGameData = [];
    console.log(`Starting merge: ${aiData.length} AI projections, ${apiSpreads.length} API games.`);

    aiData.forEach(aiGame => {
        // Find the matching game in the API results
        const apiSpreadGame = apiSpreads.find(g => 
            // Using includes() gives us flexibility (e.g., "UNC" matches "North Carolina")
            // For more accuracy, use exact match: g.game.teams.away.name === aiGame.team1
            g.game.teams.away.name.includes(aiGame.team1) &&
            g.game.teams.home.name.includes(aiGame.team2)
        );
        
        const apiTotalGame = apiTotals.find(g => g.game.id === apiSpreadGame?.game.id);

        if (apiSpreadGame && apiTotalGame) {
            // Found a match!
            console.log(`MATCH FOUND: ${aiGame.team1} @ ${aiGame.team2}`);

            const marketSpreadValue = apiSpreadGame.bookmakers[0]?.bets[0]?.values[0]?.value;
            const marketTotalValue = apiTotalGame.bookmakers[0]?.bets[0]?.values[0]?.value;

            if (marketSpreadValue && marketTotalValue) {
                const marketSpread = parseFloat(marketSpreadValue);
                const marketTotal = parseFloat(marketTotalValue.replace(/^(Over|Under)\s/i, ""));

                const projectedMargin = aiGame.projectedScore.team1 - aiGame.projectedScore.team2;
                const projectedTotal = aiGame.projectedScore.team1 + aiGame.projectedScore.team2;
                
                const aiSpreadPick = projectedMargin > (marketSpread * -1)
                    ? `${aiGame.team1} (${marketSpread})`
                    : `${aiGame.team2} (+${marketSpread * -1})`;

                const aiTotalPick = projectedTotal > marketTotal
                    ? `OVER ${marketTotal}`
                    : `UNDER ${marketTotal}`;

                finalGameData.push({
                    ...aiGame,
                    game: `${aiGame.team1} @ ${aiGame.team2}`, 
                    marketLine: {
                        spread: marketSpread,
                        total: marketTotal
                    },
                    aiPicks: {
                        spread: aiSpreadPick,
                        total: aiTotalPick
                    }
                });
            }
        }
    });

    if (finalGameData.length === 0) {
        console.warn("Data merge complete, but no matching games were found.");
    }
    
    return finalGameData;
}


