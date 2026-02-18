import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json({ limit: "256kb" }));

// ENV (Render'da hangi isimle koyduysan onu yakalayacak)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

const API_KEY = process.env.API_KEY;

// Basit health endpointleri
app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) =>
  res.status(200).json({ ok: true, service: "license-server" })
);

if (!SUPABASE_URL) {
  console.error("Missing env: SUPABASE_URL");
}
if (!SUPABASE_SERVICE_ROLE) {
  console.error("Missing env: SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY)");
}
if (!API_KEY) {
  console.error("Missing env: API_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

app.post("/verify", async (req, res) => {
  try {
    // Header kontrol
    const auth = (req.header("x-api-key") || "").trim();
    if (!API_KEY || auth !== API_KEY) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // Body kontrol
    const key = ((req.body?.key ?? "") + "").trim();
    if (!key) return res.status(400).json({ ok: false, error: "missing_key" });

    const { data, error } = await supabase
      .from("licenses")
      .select("license_key, expires_at, is_banned")
      .eq("license_key", key)
      .maybeSingle();

    if (error) {
      console.error("DB error:", error);
      return res.status(500).json({ ok: false, error: "db_error" });
    }
    if (!data) return res.status(200).json({ ok: false, error: "invalid_key" });
    if (data.is_banned) return res.status(200).json({ ok: false, error: "banned" });

    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      return res.status(200).json({ ok: false, error: "expired" });
    }

    const secondsLeft = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    return res.status(200).json({ ok: true, seconds_left: secondsLeft });
  } catch (e) {
    console.error("Server crash:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("license-server listening on", PORT));
