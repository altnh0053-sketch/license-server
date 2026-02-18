import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const API_KEY = process.env.API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

app.post("/verify", async (req, res) => {
  const auth = req.header("x-api-key") || "";
  if (!API_KEY || auth !== API_KEY) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const key = (req.body.key || "").trim();
  if (!key) return res.json({ ok: false, error: "missing_key" });

  const { data, error } = await supabase
    .from("licenses")
    .select("license_key, expires_at, is_banned")
    .eq("license_key", key)
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ ok: false, error: "db_error" });
  if (!data) return res.json({ ok: false, error: "invalid_key" });
  if (data.is_banned) return res.json({ ok: false, error: "banned" });

  const expiresAt = new Date(data.expires_at);
  const now = new Date();
  if (expiresAt <= now) {
    return res.json({ ok: false, error: "expired" });
  }

  const secondsLeft = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  return res.json({ ok: true, seconds_left: secondsLeft });
});

app.get("/", (req, res) => res.send("OK"));

app.listen(process.env.PORT || 3000);
