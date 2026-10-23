import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration missing" }, 500);

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === "GET") {
    const slug = new URL(req.url).searchParams.get("slug")?.trim();
    if (!slug || !/^[a-zA-Z0-9_-]{6,40}$/.test(slug)) {
      return json({ error: "A valid invitation slug is required" }, 400);
    }
    const { data, error } = await db
      .from("invitations")
      .select("slug,groom,bride,wedding_date,wedding_time,venue,phone,map_url,message,style,language")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) return json({ error: "Could not load invitation" }, 500);
    if (!data) return json({ error: "Invitation not found" }, 404);
    return json({ invitation: data });
  }

  if (req.method === "POST") {
    const expectedPin = Deno.env.get("INVITATION_ADMIN_PIN");
    const suppliedPin = req.headers.get("x-admin-pin");
    if (!expectedPin || !suppliedPin || suppliedPin !== expectedPin) {
      return json({ error: "Not authorized to create invitations" }, 401);
    }

    let input: Record<string, unknown>;
    try { input = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const textField = (key: string, max: number) =>
      typeof input[key] === "string" ? (input[key] as string).trim().slice(0, max) : "";
    const groom = textField("groom", 120);
    const bride = textField("bride", 120);
    const wedding_date = textField("date", 10);
    const wedding_time = textField("time", 8);
    const venue = textField("venue", 300);
    if (!groom || !bride || !/^\d{4}-\d{2}-\d{2}$/.test(wedding_date) ||
        !/^\d{2}:\d{2}(:\d{2})?$/.test(wedding_time) || !venue) {
      return json({ error: "Please provide valid names, date, time and venue" }, 400);
    }

    const phone = textField("phone", 40) || null;
    const map_url = textField("maps", 1000) || null;
    const message = textField("message", 1200) || null;
    const allowedStyles = new Set(["floral","royal","minimal","romance","burgundy","botanical","beach","arch","silver","terracotta","ornate","blackgold"]);
    const styleInput = textField("style", 30);
    const languageInput = textField("lang", 5);
    const style = allowedStyles.has(styleInput) ? styleInput : "floral";
    const language = ["ar","fr","en"].includes(languageInput) ? languageInput : "ar";

    const { data, error } = await db.from("invitations").insert({
      groom, bride, wedding_date, wedding_time, venue, phone, map_url, message, style, language, is_published: true,
    }).select("slug").single();

    if (error || !data) return json({ error: "Could not save invitation" }, 500);
    return json({ slug: data.slug }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
});
