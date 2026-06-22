const LGL_API_BASE = "https://api.littlegreenlight.com/api/v1";

// Only count gifts received on or after this date
const CAMPAIGN_START_DATE = "2026-06-01";

export const handler = async (event) => {
  const apiKey = process.env.LGL_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "LGL_API_KEY not configured" }),
    };
  }

  const campaignId = event.queryStringParameters?.campaign_id;
  if (!campaignId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "campaign_id query parameter is required" }),
    };
  }

  try {
    const { raised, count } = await fetchCampaignTotals(apiKey, campaignId);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        raised,
        count,
        lastUpdated: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error("LGL API error:", err);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unable to fetch donation data" }),
    };
  }
};

async function fetchCampaignTotals(apiKey, campaignId) {
  let raised = 0;
  let count = 0;
  let offset = 0;
  const limit = 100;
  const targetId = parseInt(campaignId, 10);

  // LGL's search endpoint does not filter by campaign_id server-side,
  // so we fetch all gifts and filter by campaign_id in memory.
  while (true) {
    const params = new URLSearchParams({
      received_from: CAMPAIGN_START_DATE,
      limit: String(limit),
      offset: String(offset),
    });

    const res = await fetch(`${LGL_API_BASE}/gifts/search?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) throw new Error(`LGL API returned ${res.status}`);

    const data = await res.json();
    const gifts = data.items ?? data.gifts ?? [];

    for (const gift of gifts) {
      if (gift.campaign_id !== targetId) continue;
      const amount = parseFloat(gift.received_amount ?? gift.amount ?? 0);
      if (!isNaN(amount)) raised += amount;
      count++;
    }

    if (gifts.length < limit) break;
    offset += limit;
  }

  return { raised: Math.round(raised * 100) / 100, count };
}
