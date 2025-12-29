import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keywords that must be present in the tweet (case-insensitive)
const REQUIRED_KEYWORDS = ['noizlabs', 'noiz', '$noiz', '@noizlabs'];
const POINTS_REWARD = 250;

// Twitter API credentials
const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();

interface TweetVerificationRequest {
  tweetUrl: string;
  walletAddress: string;
}

// Extract tweet ID from various Twitter/X URL formats
function extractTweetId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (!hostname.includes('twitter.com') && !hostname.includes('x.com')) {
      return null;
    }
    
    const pathMatch = urlObj.pathname.match(/\/status\/(\d+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    return null;
  } catch {
    return null;
  }
}

// Check if tweet content contains required keywords
function containsRequiredKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return REQUIRED_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// Generate OAuth 1.0a signature for Twitter API
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");

  console.log("OAuth Signature generated successfully");
  return signature;
}

// Generate OAuth header for Twitter API requests
function generateOAuthHeader(method: string, url: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    API_SECRET!,
    ACCESS_TOKEN_SECRET!
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    "OAuth " +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

// Fetch tweet using Twitter API v2
async function fetchTweetFromAPI(tweetId: string): Promise<{ text: string; authorId: string } | null> {
  const url = `https://api.x.com/2/tweets/${tweetId}?tweet.fields=text,author_id`;
  const method = "GET";
  
  try {
    const oauthHeader = generateOAuthHeader(method, url.split('?')[0]);
    console.log("Fetching tweet from Twitter API:", tweetId);
    
    const response = await fetch(url, {
      method: method,
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();
    console.log("Twitter API response status:", response.status);
    
    if (!response.ok) {
      console.error("Twitter API error:", responseText);
      return null;
    }

    const data = JSON.parse(responseText);
    
    if (data.data) {
      return {
        text: data.data.text || '',
        authorId: data.data.author_id || ''
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching tweet from API:", error);
    return null;
  }
}

// Check if Twitter API credentials are configured
function hasTwitterAPICredentials(): boolean {
  return !!(API_KEY && API_SECRET && ACCESS_TOKEN && ACCESS_TOKEN_SECRET);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tweetUrl, walletAddress }: TweetVerificationRequest = await req.json();

    console.log('Verifying tweet:', { tweetUrl, walletAddress });

    // Validate inputs
    if (!tweetUrl || !walletAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tweet URL and wallet address are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract tweet ID
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Twitter/X URL. Please provide a valid tweet link.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted tweet ID:', tweetId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this tweet has already been used for verification
    const { data: existingVerification } = await supabase
      .from('tweet_verifications')
      .select('id')
      .eq('tweet_id', tweetId)
      .maybeSingle();

    if (existingVerification) {
      return new Response(
        JSON.stringify({ success: false, error: 'This tweet has already been used for verification.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has already completed this quest today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: existingTask } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('task_type', 'tweet_about_noizlabs')
      .gte('last_reset', today.toISOString())
      .eq('completed', true)
      .maybeSingle();

    if (existingTask) {
      return new Response(
        JSON.stringify({ success: false, error: 'You have already completed this quest today. Try again tomorrow!' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let tweetVerified = false;
    let verificationMethod = 'unknown';

    // Try Twitter API first if credentials are available
    if (hasTwitterAPICredentials()) {
      console.log('Using Twitter API for verification');
      const tweetData = await fetchTweetFromAPI(tweetId);
      
      if (tweetData) {
        console.log('Tweet content retrieved via API');
        
        if (containsRequiredKeywords(tweetData.text)) {
          tweetVerified = true;
          verificationMethod = 'twitter_api';
          console.log('Tweet verified with keywords found via Twitter API');
        } else {
          console.log('Tweet exists but missing required keywords. Tweet text:', tweetData.text.substring(0, 100));
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Your tweet must mention NoizLabs, Noiz, $NOIZ, or @NoizLabs. Please update your tweet and try again.' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.log('Twitter API failed, falling back to oEmbed');
      }
    } else {
      console.log('Twitter API credentials not configured, using fallback method');
    }

    // Fallback to oEmbed if Twitter API didn't work
    if (!tweetVerified) {
      const embedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}`;
      
      try {
        const embedResponse = await fetch(embedUrl);
        
        if (embedResponse.ok) {
          const embedData = await embedResponse.json();
          const tweetHtml = embedData.html || '';
          
          if (containsRequiredKeywords(tweetHtml)) {
            tweetVerified = true;
            verificationMethod = 'oembed';
            console.log('Tweet verified with keywords found via oEmbed');
          } else {
            console.log('Tweet exists but missing required keywords in oEmbed');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Your tweet must mention NoizLabs, Noiz, $NOIZ, or @NoizLabs. Please update your tweet and try again.' 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          console.log('oEmbed request failed, status:', embedResponse.status);
        }
      } catch (fetchError) {
        console.error('Error fetching tweet via oEmbed:', fetchError);
      }
    }

    if (!tweetVerified) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not verify the tweet. Please make sure the tweet is public and contains NoizLabs-related content.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Tweet verified successfully via:', verificationMethod);

    // Record the tweet verification
    await supabase
      .from('tweet_verifications')
      .insert({
        wallet_address: walletAddress,
        tweet_id: tweetId,
        tweet_url: tweetUrl,
        verified: true
      });

    // Update user task progress
    const { data: userTask } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('task_type', 'tweet_about_noizlabs')
      .maybeSingle();

    if (userTask) {
      await supabase
        .from('user_tasks')
        .update({ 
          progress: 1, 
          completed: true,
          last_reset: new Date().toISOString()
        })
        .eq('id', userTask.id);
    } else {
      await supabase
        .from('user_tasks')
        .insert({
          wallet_address: walletAddress,
          task_type: 'tweet_about_noizlabs',
          progress: 1,
          target: 1,
          points_reward: POINTS_REWARD,
          completed: true,
          reset_period: 'daily'
        });
    }

    // Award points
    const { data: userPoints } = await supabase
      .from('user_points')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (userPoints) {
      await supabase
        .from('user_points')
        .update({ 
          total_points: userPoints.total_points + POINTS_REWARD,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress);
    } else {
      await supabase
        .from('user_points')
        .insert({
          wallet_address: walletAddress,
          total_points: POINTS_REWARD
        });
    }

    console.log('Tweet verification successful, awarded', POINTS_REWARD, 'points');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Tweet verified! You earned ${POINTS_REWARD} points!`,
        pointsAwarded: POINTS_REWARD,
        verificationMethod
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error verifying tweet:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred while verifying the tweet.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
