const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Strip any stray quotes, spaces, or commas from the stored key
  const raw = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const publicKey = raw.replace(/["\s,]/g, "");

  return new Response(JSON.stringify({ publicKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
