// --- SERVERLESS FUNCTION ---
// This file will live at `/api/get-games.js`
// Vercel will automatically turn this into a server endpoint
// that our front-end can call.

// --- API-SPORTS CONFIGURATION ---
const API_SPORTS_KEY = 'ec3f31e2a38fb91e324641e3a2a5c4c6'; 
const API_SPORTS_HOST = 'v1.basketball.api-sports.io';

// --- GET TODAY'S DATE (YYYY-MM-DD format) ---
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const apiDate = `${year}-${month}-${day}`; // e.g., 2025-11-03

// API-Sports League ID for NCAAB is 886
const SPREAD_URL = `https://${API_SPORTS_HOST}/odds?league=886&season=2025-2026&date=${apiDate}&bet=2`;
const TOTAL_URL = `https://${API_SPORTS_HOST}/odds?league=886&season=2025-2026&date=${apiDate}&bet=5`;

// --- AI PROJECTIONS ---
// This is your proprietary AI data.
const aiProjections = [
    {
        id: 1, team1: "Louisville", team2: "SC State",
        projectedScore: { team1: 85, team2: 63 }, 
        analysis: "This game has the largest value on the board. \n\nSpread Value: The AI projects a 22-point win, which is 13.5 points less than the 35.5-point spread. This strongly favors South Carolina State (+35.5). \n\nO/U Value: The projected total of 148 is also 9.5 points UNDER the 157.5 line."
    },
    {
        id: 2, team1: "Auburn", team2: "Bethune-Cookman",
        projectedScore: { team1: 90, team2: 57 },
        analysis: "The AI sees significant value on the favorite.\n\nSpread Value: The projected 33-point win is 7.5 points more than the 25.5-point spread, strongly favoring Auburn (-25.5).\n\nO/U Value: The projected total of 147 is 4.5 points UNDER the 151.5 line."
    },
    {
        id: 3, team1: "Iowa State", team2: "Fairleigh Dickinson",
        projectedScore: { team1: 83, team2: 54 },
        analysis: "The value here is on the total.\n\nO/U Value: The projected total of 137 is 7.5 points UNDER the 144.5 line.\n\nSpread Value: The 29-point projected win is only 1.5 points different from the 27.5-point spread, making it a 'sharp' line."
    },
    {
        id: 4, team1: "Furman", team2: "Samford",
        projectedScore: { team1: 79, team2: 74 },
        analysis: "The AI identifies 5 points of value on the road favorite.\n\nSpread Value: Furman is projected to win by 5, but the line is -0.5 (a 'pick em'). This favors Furman (-0.5).\n\nO/U Value: The projected total of 153 is sharp against the 152.5 line."
    },
    {
        id: 5, team1: "Creighton", team2: "North Florida",
        projectedScore: { team1: 88, team2: 65 },
        analysis: "AI finds 4.5 points of value on the total.\n\nO/U Value: The AI projection of 153 is 4.5 points UNDER the 157.5 line.\n\nSpread Value: The AI's 23-point win is very close to the -22.5 spread."
    },
    {
        id: 6, team1: "Marquette", team2: "Radford",
        projectedScore: { team1: 85, team2: 63 },
        analysis: "The AI likes the underdog to cover this large spread.\n\nSpread Value: The AI projects a 22-point win, which is 4.5 points less than the 26.5 spread. This favors Radford (+26.5).\n\nO/U Value: The total is sharp (148 vs 148.5)."
    },
    {
        id: 7, team1: "Tennessee", team2: "Murray State",
        projectedScore: { team1: 80, team2: 60 },
        analysis: "A very sharp line from the market.\n\nSpread Value: The AI projects a 20-point win, right on the -19.5 line.\n\nO/U Value: The AI projects 140 total points, right on the 140.5 line."
    },
    {
        id: 8, team1: "Illinois", team2: "MVSU",
        projectedScore: { team1: 92, team2: 55 },
        analysis: "AI and market agree on this large spread.\n\nSpread Value: AI projects a 37-point win, vs. a -37.5 spread. Very sharp.\n\nO/U Value: AI's total of 147 is 4.5 points UNDER the 151.5 line."
    },
    {
        id: 9, team1: "UNC", team2: "Elon",
        projectedScore: { team1: 90, team2: 63 },
        analysis: "Strong value on the under.\n\nO/U Value: The AI projects 153 total points, a full 6 points UNDER the 159.0 line.\n\nSpread Value: The 27-point projected win is very close to the -26.5 spread."
    },
    {
        id: 10, team1: "Baylor", team2: "James Madison",
        projectedScore: { team1: 82, team2: 75 },
        analysis: "AI finds value on the underdog, James Madison.\n\nSpread Value: AI projects a 7-point win for Baylor, but the spread is -10.5. This 3.5-point difference favors James Madison (+10.5).\n\nO/U Value: The line is sharp (157 vs 157.5)."
    },
    {
        id: 11, team1: "UConn", team2: "Northern Arizona",
        projectedScore: { team1: 89, team2: 60 },
        analysis: "AI sees 4.5 points of value on the total.\n\nO/U Value: The AI total of 149 is 4.5 points UNDER the 153.5 line.\n\nSpread Value: The projected 29-point win is very close to the -28.5 spread."
    },
    {
        id: 12, team1: "BYU", team2: "San Diego St",
        projectedScore: { team1: 72, team2: 68 },
        analysis: "Classic AI vs. Market disagreement. The AI has BYU as a 4-point favorite, but the market has them as a 3-point underdog. This is a 7-point value discrepancy.\n\nSpread Value: AI strongly favors BYU (+3.0)."
    },
    {
        id: 13, team1: "Houston", team2: "Lehigh",
        projectedScore: { team1: 86, team2: 50 },
        analysis: `This is the "sharpest" line of the day, according to the AI. The projected 36-point win and 136-point total are almost identical to the betting lines.`
    },
    {
        id: 42, team1: "Alabama", team2: "North Dakota",
        projectedScore: { team1: 100, team2: 68 },
        analysis: "A sharp line on a high-scoring game. The AI's 32-point projected win is right on the -31.5 spread.\n\nThe projected total of 168 is also right on the 168.5 line."
    }
];

// This is the main serverless function handler.
// Vercel will run this code every time someone visits /api/get-games
export default async function handler(request, response) {
    
    // Add a check to prevent abuse, e.g., only allow from your domain
    // (This is a good practice for a real product)
    
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

        // Check for API errors in the response
        if (spreadData.errors?.token || totalData.errors?.token) {
             throw new Error("API Key is invalid or not authorized.");
        }
        if (!spreadData.response || !totalData.response) {
            throw new Error("Invalid data structure received from API-Sports.");
        }

        // --- Step 2: Merge API Data with AI Projections ---
        const mergedGameData = mergeAPIData(aiProjections, spreadData.response, totalData.response);
        
        // --- Step 3: Return the merged data as JSON ---
        // This is what the front-end will receive.
        // We also add caching headers to be nice to our API limit.
        // This tells Vercel to cache the result for 15 minutes (900 seconds).
        response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
        response.status(200).json(mergedGameData);

    } catch (error) {
        console.error("Failed to fetch or render live data:", error);
        // Send a JSON error object back to the front-end
        response.status(500).json({ error: error.message });
    }
}

/**
 * This is the exact same merge logic from our HTML file.
 * It loops through AI predictions and matches them with live market data.
 */
function mergeAPIData(aiData, apiSpreads, apiTotals) {
    const finalGameData = [];

    aiData.forEach(aiGame => {
        // Find the matching game in the API results
        const apiSpreadGame = apiSpreads.find(g => 
            g.game.teams.away.name.includes(aiGame.team1) &&
            g.game.teams.home.name.includes(aiGame.team2)
        );
        
        const apiTotalGame = apiTotals.find(g => g.game.id === apiSpreadGame?.game.id);

        if (apiSpreadGame && apiTotalGame) {
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
