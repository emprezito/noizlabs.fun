import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = "https://myinstants-api.vercel.app";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    let endpoint: string | null = null;
    let params: Record<string, string> = {};

    // Support both POST (supabase.functions.invoke) and GET (query params)
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        endpoint = body.endpoint;
        params = body.params || {};
      } catch {
        return new Response(JSON.stringify([]), { headers: jsonHeaders });
      }
    } else {
      const url = new URL(req.url);
      endpoint = url.searchParams.get("endpoint");
      url.searchParams.forEach((value, key) => {
        if (key !== "endpoint") params[key] = value;
      });
    }

    if (!endpoint || typeof endpoint !== "string") {
      return new Response(JSON.stringify([]), { headers: jsonHeaders });
    }

    const validEndpoints = ["trending", "search", "detail", "recent", "best", "uploaded", "favorites"];
    if (!validEndpoints.includes(endpoint)) {
      return new Response(JSON.stringify([]), { headers: jsonHeaders });
    }

    // Some endpoints need a q param to work
    if ((endpoint === "recent" || endpoint === "best") && !params.q) {
      params.q = "us";
    }

    const queryParams = new URLSearchParams(params);
    const url = `${API_BASE}/${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    console.log("Proxying:", url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error("API error:", response.status, rawText.substring(0, 200));
      return new Response(JSON.stringify([]), { headers: jsonHeaders });
    }

    // Safely parse JSON - return empty array if HTML or garbage
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Non-JSON response:", rawText.substring(0, 200));
      return new Response(JSON.stringify([]), { headers: jsonHeaders });
    }

    // Handle API error objects like {"status":"404","message":"..."}
    if (data && !Array.isArray(data) && (data.status === "404" || data.error)) {
      console.warn("API error object:", JSON.stringify(data));
      return new Response(JSON.stringify([]), { headers: jsonHeaders });
    }

    const result = Array.isArray(data) ? data : [data];
    console.log(`${endpoint} returned ${result.length} items`);

    return new Response(JSON.stringify(result), { headers: jsonHeaders });
  } catch (error: unknown) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify([]), { headers: jsonHeaders });
  }
});
