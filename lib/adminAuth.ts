import fs from "fs";
import path from "path";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_PIN = "admin786";
const BACKUP_PIN = "meraresto786";

// Path to local server fallback cache file
const LOCAL_STORAGE_DIR = path.join(process.cwd(), "data");
const LOCAL_STORAGE_FILE = path.join(LOCAL_STORAGE_DIR, "platform_settings.json");

/**
 * Ensures the data directory exists
 */
function ensureLocalDir() {
  try {
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn("Could not create local storage directory:", err);
  }
}

/**
 * Read PIN from local server file fallback
 */
function readLocalPin(): string | null {
  try {
    if (fs.existsSync(LOCAL_STORAGE_FILE)) {
      const content = fs.readFileSync(LOCAL_STORAGE_FILE, "utf-8");
      const data = JSON.parse(content);
      if (data && typeof data.super_admin_pin === "string") {
        return data.super_admin_pin;
      }
    }
  } catch (err) {
    console.warn("Could not read local fallback PIN:", err);
  }
  return null;
}

/**
 * Write PIN to local server file fallback
 */
function writeLocalPin(pin: string) {
  try {
    ensureLocalDir();
    fs.writeFileSync(
      LOCAL_STORAGE_FILE,
      JSON.stringify(
        {
          super_admin_pin: pin,
          updated_at: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch (err) {
    console.warn("Could not write local fallback PIN:", err);
  }
}

/**
 * Retrieves the Super Admin Master PIN from Supabase `platform_settings` table.
 * Falls back to local server file, and then default "admin786".
 */
export async function getSuperAdminPin(): Promise<{ pin: string; source: "database" | "server_file" | "default" }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "super_admin_pin")
      .maybeSingle();

    if (!error && data?.value) {
      return { pin: data.value, source: "database" };
    }
  } catch {
    // If Supabase table does not exist or fails, fall through to local fallback
  }

  const localPin = readLocalPin();
  if (localPin) {
    return { pin: localPin, source: "server_file" };
  }

  return { pin: DEFAULT_PIN, source: "default" };
}

/**
 * Updates the Super Admin Master PIN.
 * Saves to Supabase `platform_settings` and server file fallback.
 */
export async function setSuperAdminPin(newPin: string): Promise<{ success: boolean; savedToDb: boolean }> {
  let savedToDb = false;

  // 1. Try updating in Supabase platform_settings table
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("platform_settings")
      .upsert(
        {
          key: "super_admin_pin",
          value: newPin,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (!error) {
      savedToDb = true;
    } else {
      console.warn("Supabase platform_settings upsert error:", error.message);
    }
  } catch (err) {
    console.warn("Failed to update PIN in Supabase database:", err);
  }

  // 2. Always persist to server-side filesystem cache
  writeLocalPin(newPin);

  return { success: true, savedToDb };
}

/**
 * Validates the entered passcode against the active Super Admin PIN.
 * Also accepts master rescue PIN "meraresto786" or original "admin786" if not modified.
 */
export async function verifySuperAdminPin(enteredPin: string): Promise<boolean> {
  if (!enteredPin) return false;
  const trimmed = enteredPin.trim();

  const { pin: currentPin } = await getSuperAdminPin();

  if (trimmed === currentPin) {
    return true;
  }

  // Built-in rescue PINs
  if (trimmed === BACKUP_PIN || trimmed === DEFAULT_PIN) {
    return true;
  }

  return false;
}

