// =============================================================
// chat.js - Netlify Serverless Function
// Claude API (Anthropic) AI Chat with streaming
// =============================================================

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are the AI assistant for Shirokuma Denryoku's inventory management system.

## Role
- Answer questions about inventory data (items, quantities, order status) accurately
- Provide data-driven analysis and suggestions
- Offer expert advice on procurement and inventory management

## Rules
1. Use the inventory context (JSON) provided by users as the primary information source
2. For data not in context, honestly say "Cannot confirm from current data"
3. Quote numbers accurately, never fabricate figures
4. Keep answers concise, use bullet points for readability
5. Proactively warn about stock shortages or missed orders
6. Reply in Japanese by default, Korean if asked in Korean

## Style
- Polite but business-like
- Concise, covering key points
- Use tables/lists when helpful`;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { message, history = [] } = JSON.parse(event.body);

    if (!message || typeof message !== "string") {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "message is required" }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }) };
    }

    const messages = [];
    for (const h of history) {
      if (h.role && h.content) {
        messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: "user", content: message });

    // Use streaming to Claude API, then consume server-side
    // (Netlify Functions/Lambda cannot return ReadableStream as body)
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        stream: true,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return { statusCode: response.status, headers, body: JSON.stringify({ error: "API error: " + response.status }) };
    }

    // Consume the SSE stream and extract text
    const rawBody = await response.text();
    let fullText = "";
    const lines = rawBody.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
          fullText += ev.delta.text;
        }
      } catch (e) {}
    }

    if (!fullText) fullText = "\u5fdc\u7b54\u306a\u3057";

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ response: fullText }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Internal server error: " + err.message }) };
  }
};
