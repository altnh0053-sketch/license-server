import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// Render ENV'leri
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.API_KEY;

if (!SUPABASE_URL) throw new Error("SUPABASE_URL missing");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
if (!API_KEY) throw new Error("API_KEY missing");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, service: "license-server" });
});

// License verify
app.post("/verify", async (req, res) => {
  try {
    const auth = req.header("x-api-key") || "";
    if (auth !== API_KEY) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const key = String(req.body?.key ?? "").trim();
    if (!key) {
      return res.status(400).json({ ok: false, error: "missing_key" });
    }

    const { data, error } = await supabase
      .from("licenses")
      .select("license_key, expires_at, is_banned")
      .eq("license_key", key)
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "db_error", details: error.message });
    }

    if (!data) {
      return res.status(200).json({ ok: false, error: "invalid_key" });
    }

    if (data.is_banned) {
      return res.status(200).json({ ok: false, error: "banned" });
    }

    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (Number.isNaN(expiresAt.getTime())) {
      return res.status(500).json({ ok: false, error: "bad_expires_at" });
    }

    if (expiresAt <= now) {
      return res.status(200).json({ ok: false, error: "expired" });
    }

    const secondsLeft = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

    return res.status(200).json({
      ok: true,
      seconds_left: secondsLeft,
      expires_at: expiresAt.toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", details: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`License server running on port ${PORT}`));
