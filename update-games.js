// This function runs on a schedule (defined in vercel.json)
// Its job is to fetch data from The Odds API and save it to Vercel KV.

// 1. We must import the Vercel KV client
import { kv } from '@vercel/kv';

// 2. Add your NEW API key from The Odds API
const ODDS_API_KEY = process.env.ODDS_API_KEY; 
const SPORT = 'basketball_ncaab';
const REGIONS = 'us';
const MARKETS = 'spreads,totals';
const ODDS_FORMAT = 'american';

const ODDS_API_URL = `https://api.the-odds-api.com/v4/sports/${SPORT}/odds/?apiKey=${ODDS_API_KEY}&regions=${REGIONS}&markets=${MARKETS}&oddsFormat=${ODDS_FORMAT}`;

// --- !! IMPORTANT: DAILY UPDATE REQUIRED !! ---
// This list MUST be updated with your AI's projections for TODAY'S games.
const aiProjections = [
    // {
    //     id: 1, 
    //     team1: "Duke", // This must match the API's "away_team"
    //     team2: "Kentucky",   // This must match the API's "home_team"
    //     projectedScore: { team1: 78, team2: 75 }, 
    //     analysis: "AI projects a tight game, favoring Duke to cover..."
    // },
    // {
    //     id: 2, 
    //     team1: "Kansas", 
    //     team2: "Michigan St",
    //     projectedScore: { team1: 82, team2: 70 }, 
    //     analysis: "AI finds strong value on Kansas..."
    // }
    // --- (Add your real projections here) ---
];


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
            // Clear the old data
            await kv.set('todays-games', []); 
            return response.status(200).json({ status: "No games found, cache cleared." });
        }
        
        console.log(`CRON: Found ${apiGames.length} games. Merging with ${aiProjections.length} AI projections.`);

        // --- Step 2: Merge API Data with AI Projections ---
        const mergedGameData = mergeAPIData(aiProjections, apiGames);
        
        // --- Step 3: Save the merged data to Vercel KV ---
        // The key 'todays-games' is what our other function will read.
        await kv.set('todays-games', mergedGameData);

        console.log(`CRON: Success. Saved ${mergedGameData.length} merged games to KV store.`);
        response.status(200).json({ status: "Success", merged: mergedGameData.length });

    } catch (error) {
        console.error("CRON Error:", error.message);
        response.status(500).json({ error: error.message });
    }
}

/**
 * Merge logic for "The Odds API"
 */
function mergeAPIData(aiData, apiGames) {
    const finalGameData = [];

    aiData.forEach(aiGame => {
        // Find the matching game in the API results
        const apiGame = apiGames.find(g => 
            g.away_team.includes(aiGame.team1) &&
            g.home_team.includes(aiGame.team2)
        );

        if (apiGame) {
            console.log(`CRON: Match found for ${aiGame.team1} @ ${aiGame.team2}`);
            
            // Find the 'BetMGM' bookmaker, or fall back to the first one
            let bookmaker = apiGame.bookmakers.find(b => b.key === "betmgm") || apiGame.bookmakers[0];
            if (!bookmaker) {
                console.warn(`No bookmakers found for ${apiGame.id}`);
                return; // Skip this game
            }
            
            // Find the 'spread' and 'total' markets
            const spreadMarket = bookmaker.markets.find(m => m.key === "spreads");
            const totalMarket = bookmaker.markets.find(m => m.key === "totals");

            if (spreadMarket && totalMarket) {
                // Find the lines for the Away team (team1) and Home team (team2)
                const awaySpreadData = spreadMarket.outcomes.find(o => o.name === aiGame.team1);
                const homeSpreadData = spreadMarket.outcomes.find(o => o.name === aiGame.team2);
                
                // Find the Over/Under data
                const overData = totalMarket.outcomes.find(o => o.name === "Over");

                if (awaySpreadData && homeSpreadData && overData) {
                    const marketSpread = awaySpreadData.point; // e.g., -3.5
                    const marketTotal = overData.point;       // e.g., 157.5

                    const projectedMargin = aiGame.projectedScore.team1 - aiGame.projectedScore.team2;
                    const projectedTotal = aiGame.projectedScore.team1 + aiGame.projectedScore.team2;
                    
                    const aiSpreadPick = projectedMargin > marketSpread 
                        ? `${aiGame.team1} (${marketSpread})`
                        : `${aiGame.team2} (${homeSpreadData.point})`;

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
        }
    });
    
    return finalGameData;
}
