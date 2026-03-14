import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = "https://myinstants-api.vercel.app";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, params } = await req.json();

    if (!endpoint || typeof endpoint !== "string") {
      return new Response(JSON.stringify({ error: "endpoint required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validEndpoints = ["trending", "search", "detail", "recent", "best", "uploaded", "favorites"];
    if (!validEndpoints.includes(endpoint)) {
      return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // recent and best require q param (region code), default to "us"
    const finalParams = { ...(params || {}) };
    if ((endpoint === "recent" || endpoint === "best") && !finalParams.q) {
      finalParams.q = "us";
    }

    const queryParams = new URLSearchParams(finalParams);
    const url = `${API_BASE}/${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    console.log("Proxying request to:", url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NoizLabs/1.0)',
        'Accept': 'application/json',
      },
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error("MyInstants API error:", response.status, rawText.substring(0, 200));
      return new Response(JSON.stringify({ error: `API returned ${response.status}`, data: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to parse as JSON, return empty array on failure
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Non-JSON response:", rawText.substring(0, 300));
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // API sometimes returns error objects like {"status":"404","message":"..."}
    if (data && typeof data === "object" && !Array.isArray(data) && data.status === "404") {
      console.warn("API returned 404 object:", JSON.stringify(data));
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Wrap non-array responses
    const result = Array.isArray(data) ? data : [data];
    console.log(`MyInstants ${endpoint} returned ${result.length} items`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Proxy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message, data: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
