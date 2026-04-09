// ============================================================
// chat.js - Netlify Serverless Function
// Claude API (Anthropic) AI Chat with Supabase DB connectivity
// zaiko-kanrihyou - Inventory Management System
// ============================================================
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `あなたは「しろくま電力」の在庫管理アシスタントです。太陽光発電所の建設資材の在庫データを検索・分析して回答します。

## 重要ルール
- 回答は **プレーンテキスト（Markdown可）** で返す。HTMLタグは使わない。
- テーブルはMarkdown記法（| col1 | col2 |）で書く。
- 金額は「¥」と3桁カンマ区切り（例: ¥4,200,000）
- DBに無い情報は「DBに未登録」と明示
- 推測は「推定」と明記

## DB構造
### locationsテーブル（倉庫・現場）
id, name(拠点名), sheet_name(シート名), description(説明)

### inventory_itemsテーブル（在庫品目）
id, location_id(拠点ID), item_no(品番), product_name(品名), owner(所有者), supplier(仕入先), location_detail(保管場所詳細), model(型式), manufacturer(メーカー), quantity(数量), unit(単位), unit_price(単価), total_price(合計金額), remarks(備考)

### daily_countsテーブル（日次在庫カウント）
id, item_id(品目ID), count_date(カウント日), count_value(カウント値)

## 回答スタイル
- 最初に簡潔な要約（2-3行）
- 次にデータの詳細
- 必要に応じて注意点・推奨事項
- 在庫不足や異常があれば積極的に警告する
- 日本語で丁寧に回答。韓国語で質問された場合は韓国語で回答

## ツール使用の効率化
- 1回の回答に使うツール呼び出しは最大3回まで
- 必要なデータは可能な限り1-2回の検索で取得する`;

const TOOLS = [
  { name: "search_inventory", description: "在庫品目を検索。品名,品番,メーカー,仕入先,型式等で部分一致検索。", input_schema: { type: "object", properties: { query: { type: "string", description: "検索キーワード" }, field: { type: "string", enum: ["product_name","item_no","manufacturer","supplier","model","owner","all"], default: "all" }, limit: { type: "integer", default: 30 } }, required: ["query"] } },
  { name: "get_item_by_id", description: "IDで在庫品目の全フィールドを取得", input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] } },
  { name: "get_locations", description: "全拠点（倉庫・現場）の一覧を取得", input_schema: { type: "object", properties: {} } },
  { name: "get_items_by_location", description: "指定拠点の在庫品目一覧を取得", input_schema: { type: "object", properties: { location_id: { type: "integer", description: "拠点ID" }, sort_by: { type: "string", enum: ["product_name","quantity","unit_price","item_no"], default: "product_name" }, limit: { type: "integer", default: 50 } }, required: ["location_id"] } },
  { name: "get_low_stock_items", description: "在庫数量が指定値以下の品目を取得（在庫不足チェック）", input_schema: { type: "object", properties: { threshold: { type: "integer", default: 5, description: "この数量以下を抽出" }, limit: { type: "integer", default: 30 } } } },
  { name: "inventory_summary", description: "在庫の統計情報（拠点別品目数、総品目数、総金額等）", input_schema: { type: "object", properties: {} } },
  { name: "get_daily_counts", description: "指定品目の日次在庫カウント履歴を取得", input_schema: { type: "object", properties: { item_id: { type: "integer", description: "品目ID" }, limit: { type: "integer", default: 30, description: "取得件数" } }, required: ["item_id"] } },
  { name: "search_by_manufacturer", description: "メーカー別の在庫品目一覧を取得", input_schema: { type: "object", properties: { manufacturer: { type: "string", description: "メーカー名" }, limit: { type: "integer", default: 50 } }, required: ["manufacturer"] } }
];

// === Supabase helper ===
async function sb(path) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`;
  try {
    const res = await fetch(url, { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`, "Content-Type": "application/json" } });
    if (!res.ok) { const txt = await res.text(); return { error: `HTTP ${res.status}: ${txt.slice(0, 200)}` }; }
    return await res.json();
  } catch (e) { return { error: e.message }; }
}

// === Tool implementations ===
const ITEM_SEL = "select=id,location_id,item_no,product_name,owner,supplier,location_detail,model,manufacturer,quantity,unit,unit_price,total_price,remarks";

async function searchInventory(query, field = "all", limit = 30) {
  const q = encodeURIComponent(query);
  if (field === "all") return sb(`inventory_items?${ITEM_SEL}&or=(product_name.ilike.*${q}*,item_no.ilike.*${q}*,manufacturer.ilike.*${q}*,supplier.ilike.*${q}*,model.ilike.*${q}*,owner.ilike.*${q}*,remarks.ilike.*${q}*)&limit=${limit}&order=product_name`);
  return sb(`inventory_items?${ITEM_SEL}&${field}=ilike.*${q}*&limit=${limit}&order=product_name`);
}

async function getItemById(id) { return sb(`inventory_items?id=eq.${id}&select=*`); }

async function getLocations() { return sb("locations?select=id,name,sheet_name,description&order=id"); }

async function getItemsByLocation(locationId, sortBy = "product_name", limit = 50) {
  return sb(`inventory_items?${ITEM_SEL}&location_id=eq.${locationId}&order=${sortBy}.asc.nullslast&limit=${limit}`);
}

async function getLowStockItems(threshold = 5, limit = 30) {
  return sb(`inventory_items?${ITEM_SEL}&quantity=lte.${threshold}&quantity=gt.0&order=quantity.asc&limit=${limit}`);
}

async function inventorySummary() {
  const [items, locations] = await Promise.all([
    sb("inventory_items?select=id,location_id,quantity,unit_price,total_price"),
    sb("locations?select=id,name")
  ]);
  if (!Array.isArray(items) || !Array.isArray(locations)) return { error: "Failed to fetch data" };

  const locMap = {};
  locations.forEach(l => { locMap[l.id] = l.name; });

  const byLoc = {};
  let totalItems = 0, totalValue = 0;
  items.forEach(item => {
    const locName = locMap[item.location_id] || "不明";
    if (!byLoc[locName]) byLoc[locName] = { count: 0, value: 0 };
    byLoc[locName].count++;
    byLoc[locName].value += (item.total_price || 0);
    totalItems++;
    totalValue += (item.total_price || 0);
  });

  return {
    total_items: totalItems,
    total_locations: locations.length,
    total_value: totalValue,
    by_location: Object.entries(byLoc).map(([name, info]) => ({ location: name, item_count: info.count, total_value: info.value }))
  };
}

async function getDailyCounts(itemId, limit = 30) {
  return sb(`daily_counts?item_id=eq.${itemId}&select=id,count_date,count_value&order=count_date.desc&limit=${limit}`);
}

async function searchByManufacturer(manufacturer, limit = 50) {
  const q = encodeURIComponent(manufacturer);
  return sb(`inventory_items?${ITEM_SEL}&manufacturer=ilike.*${q}*&order=product_name&limit=${limit}`);
}

async function executeTool(name, input) {
  switch (name) {
    case "search_inventory": return searchInventory(input.query || "", input.field || "all", input.limit || 30);
    case "get_item_by_id": return getItemById(input.id || 0);
    case "get_locations": return getLocations();
    case "get_items_by_location": return getItemsByLocation(input.location_id || 0, input.sort_by || "product_name", input.limit || 50);
    case "get_low_stock_items": return getLowStockItems(input.threshold || 5, input.limit || 30);
    case "inventory_summary": return inventorySummary();
    case "get_daily_counts": return getDailyCounts(input.item_id || 0, input.limit || 30);
    case "search_by_manufacturer": return searchByManufacturer(input.manufacturer || "", input.limit || 50);
    default: return { error: `Unknown tool: ${name}` };
  }
}

// === Claude API: Tool use loop (non-streaming) then streaming final response ===
async function processToolUse(messages, maxIter) {
  for (let i = 0; i < maxIter; i++) {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, tools: TOOLS, messages }),
    });

    if (!res.ok) { const txt = await res.text(); return { error: `Claude API error ${res.status}: ${txt.slice(0, 500)}` }; }
    const result = await res.json();
    const content = result.content || [];

    if (result.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content });
      const toolResults = [];
      for (const block of content) {
        if (block.type === "tool_use") {
          console.log(`[Tool] ${block.name}(${JSON.stringify(block.input).slice(0, 80)})`);
          const output = await executeTool(block.name, block.input);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(output).slice(0, 12000) });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Final text response - extract directly (no second API call needed)
    const textBlocks = content.filter(b => b.type === "text").map(b => b.text);
    return { done: true, response: textBlocks.join("\n") || "応答を生成できませんでした" };
  }
  return { error: "Max iterations exceeded" };
}

// === Handler ===
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const body = JSON.parse(event.body);
    const msg = body.message || "";
    const hist = body.history || [];

    if (!msg) return { statusCode: 400, headers, body: JSON.stringify({ error: "empty message" }) };

    const messages = hist.slice(-8).map(h => ({ role: h.role, content: h.content }));
    messages.push({ role: "user", content: msg });

    const result = await processToolUse(messages, 5);

    if (result.error) {
      return { statusCode: 500, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: result.error }) };
    }

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ response: result.response }),
    };
  } catch (e) {
    console.error("Function error:", e);
    return { statusCode: 500, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: e.message }) };
  }
};
