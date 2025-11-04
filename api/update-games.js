// This function runs on a schedule (defined in vercel.json)
// Its job is to fetch data from The Odds API, generate AI projections,
// and save the merged data to Vercel KV.

import { kv } from '@vercel/kv';

// --- Odds API Config ---
const ODDS_API_KEY = process.env.ODDS_API_KEY; 
const SPORT = 'basketball_ncaab';
const REGIONS = 'us';
const MARKETS = 'spreads,totals';
const ODDS_FORMAT = 'american';
const ODDS_API_URL = `https://api.the-odds-api.com/v4/sports/${SPORT}/odds/?apiKey=${ODDS_API_KEY}&regions=${REGIONS}&markets=${MARKETS}&oddsFormat=${ODDS_FORMAT}`;

// --- Gemini AI Config ---
// We leave the API key blank, as it's provided by the environment
const GEMINI_API_KEY = ""; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

// Define the JSON schema we want the AI to return
const GEMINI_JSON_SCHEMA = {
    type: "OBJECT",
    properties: {
        "projectedScore": {
            type: "OBJECT",
            properties: {
                "team1": { "type": "INTEGER" }, // away_team
                "team2": { "type": "INTEGER" }  // home_team
            }
        },
        "analysis": { 
            "type": "STRING",
            "description": "A 1-2 sentence analysis of the pick, explaining the value."
        }
    },
    required: ["projectedScore", "analysis"]
};

// --- !! REMOVED !! ---
// const aiProjections = [ ... ];
// This is no longer needed, as we will generate projections dynamically.


// This is the main serverless function
export default async function handler(request, response) {
    if (!ODDS_API_KEY) {
        return response.status(500).json({ error: "ODDS_API_KEY is not configured." });
    }

    try {
        console.log("CRON: Starting job. Fetching from The Odds API...");
        const apiResponse = await fetch(ODDS_API_URL);

        if (!apiResponse.ok) {
            throw new Error(`The Odds API Error: ${apiResponse.status} ${apiResponse.statusText}`);
        }

        const apiGames = await apiResponse.json();
        
        if (!apiGames || apiGames.length === 0) {
            console.log("CRON: No games found from The Odds API.");
            await kv.set('todays-games', []); 
            return response.status(200).json({ status: "No games found, cache cleared." });
        }
        
        console.log(`CRON: Found ${apiGames.length} games. Now generating AI projections...`);

        // --- Step 2: Generate AI Projections and Merge Data ---
        // This function now does both steps in one pass
        const mergedGameData = await generateAndMergeData(apiGames);
        
        // --- Step 3: Save the merged data to Vercel KV ---
        await kv.set('todays-games', mergedGameData);

        console.log(`CRON: Success. Saved ${mergedGameData.length} merged games to KV store.`);
        response.status(200).json({ status: "Success", merged: mergedGameData.length });

    } catch (error) {
        console.error("CRON Error:", error.message);
        response.status(500).json({ error: error.message });
    }
}

/**
 * NEW: Calls the Gemini API to get a projection for a single game.
 */
async function getGeminiProjection(apiGame) {
    const { away_team, home_team } = apiGame;

    const systemPrompt = "You are an expert college basketball analyst. Your specialty is quantitative modeling and predicting final scores. You are concise and always provide your response in the requested JSON format.";
    
    const userQuery = `Analyze the upcoming NCAAB game: ${away_team} (team1) @ ${home_team} (team2). Provide a projected final score and a brief 1-2 sentence analysis.`;

    const payload = {
        contents: [{ 
            parts: [{ text: userQuery }] 
        }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_JSON_SCHEMA,
            temperature: 0.7,
        }
    };

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0].text) {
            const jsonText = result.candidates[0].content.parts[0].text;
            const aiProjection = JSON.parse(jsonText);
            
            // Add the original team names for merging
            return {
                ...aiProjection,
                team1: away_team,
                team2: home_team,
                id: apiGame.id // Use the API game ID for a stable ID
            };
        } else {
            throw new Error("Invalid response structure from Gemini API.");
        }
    } catch (error) {
        console.error(`Error generating projection for ${away_team} @ ${home_team}: ${error.message}`);
        return null; // Don't let one failed game stop the whole process
    }
}

/**
 * Helper function for retrying API calls with exponential backoff.
 * This is crucial for handling API rate limits or temporary network issues.
 */
async function exponentialBackoff(fn, retries = 5, delay = 1000) {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            console.warn(`Retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return exponentialBackoff(fn, retries - 1, delay * 2);
        } else {
            throw error;
        }
    }
}


/**
 * NEW: Replaces mergeAPIData.
 * This function loops through all games from The Odds API,
 * calls Gemini for a projection for each one,
 * and then merges the market data with the new AI projection.
 */
async function generateAndMergeData(apiGames) {
    const finalGameData = [];

    // Use Promise.all to run AI projections in parallel (max 5 at a time)
    // This is much faster than doing them one by one.
    const batchSize = 5;
    for (let i = 0; i < apiGames.length; i += batchSize) {
        const batch = apiGames.slice(i, i + batchSize);
        console.log(`CRON: Processing batch ${Math.floor(i / batchSize) + 1}...`);
        
        const promises = batch.map(apiGame => 
            exponentialBackoff(() => getGeminiProjection(apiGame))
                .then(aiGame => {
                    if (!aiGame) return null; // AI projection failed

                    // --- Start Merge Logic ---
                    // This logic is from the old mergeAPIData function
                    let bookmaker = apiGame.bookmakers.find(b => b.key === "betmgm") || apiGame.bookmakers[0];
                    if (!bookmaker) {
                        console.warn(`No bookmakers found for ${apiGame.id}`);
                        return null; 
                    }
                    
                    const spreadMarket = bookmaker.markets.find(m => m.key === "spreads");
                    const totalMarket = bookmaker.markets.find(m => m.key === "totals");

                    if (spreadMarket && totalMarket) {
                        const awaySpreadData = spreadMarket.outcomes.find(o => o.name === aiGame.team1);
                        const homeSpreadData = spreadMarket.outcomes.find(o => o.name === aiGame.team2);
                        const overData = totalMarket.outcomes.find(o => o.name === "Over");

                        if (awaySpreadData && homeSpreadData && overData) {
                            const marketSpread = awaySpreadData.point;
                            const marketTotal = overData.point;

                            const projectedMargin = aiGame.projectedScore.team1 - aiGame.projectedScore.team2;
                            const projectedTotal = aiGame.projectedScore.team1 + aiGame.projectedScore.team2;
                            
                            const aiSpreadPick = projectedMargin > marketSpread 
                                ? `${aiGame.team1} (${marketSpread})`
                                : `${aiGame.team2} (${homeSpreadData.point})`;

                            const aiTotalPick = projectedTotal > marketTotal
                                ? `OVER ${marketTotal}`
                                : `UNDER ${marketTotal}`;

                            // This is the final, merged object to be saved
                            return {
                                ...aiGame, // contains id, team1, team2, projectedScore, analysis
                                game: `${aiGame.team1} @ ${aiGame.tam2}`, 
                                marketLine: {
                                    spread: marketSpread,
                                    total: marketTotal
                                },
                                aiPicks: {
                                    spread: aiSpreadPick,
                                    total: aiTotalPick
                                }
                            };
                        }
                    }
                    // --- End Merge Logic ---
                    return null; // Markets not found
                })
        );
        
        // --- THIS IS THE FIX ---
        // Was: const results = await Promise.all(results);
        // Now: const results = await Promise.all(promises);
        const results = await Promise.all(promises);
        finalGameData.push(...results.filter(game => game != null));
    }
    
    return finalGameData;
}

