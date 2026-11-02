import { NextResponse } from "next/server";
import {
  verifySuperAdminPin,
  setSuperAdminPin,
  getSuperAdminPin,
} from "@/lib/adminAuth";

export async function GET() {
  try {
    const { source } = await getSuperAdminPin();
    return NextResponse.json({
      success: true,
      storageSource: source,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get auth status" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin, action, newPin, currentPin } = body;

    // Support action="change_pin" in POST as well
    if (action === "change_pin") {
      const pinToSet = newPin?.trim();
      if (!pinToSet || pinToSet.length < 4) {
        return NextResponse.json(
          { error: "New PIN must be at least 4 characters long." },
          { status: 400 }
        );
      }

      if (currentPin) {
        const isCurrentValid = await verifySuperAdminPin(currentPin);
        if (!isCurrentValid) {
          return NextResponse.json(
            { error: "Current PIN is incorrect." },
            { status: 403 }
          );
        }
      }

      const result = await setSuperAdminPin(pinToSet);
      return NextResponse.json({
        success: true,
        message: "PIN successfully updated.",
        savedToDb: result.savedToDb,
      });
    }

    // Default verify action
    if (!pin) {
      return NextResponse.json(
        { error: "PIN is required for verification." },
        { status: 400 }
      );
    }

    const isValid = await verifySuperAdminPin(pin);
    if (isValid) {
      return NextResponse.json({
        success: true,
        authenticated: true,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Incorrect Master Passcode. Default is 'admin786'.",
        },
        { status: 401 }
      );
    }
  } catch (err: unknown) {
    console.error("Super Admin auth error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Authentication error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { newPin, currentPin } = body;

    const pinToSet = newPin?.trim();
    if (!pinToSet || pinToSet.length < 4) {
      return NextResponse.json(
        { error: "New PIN must be at least 4 characters long." },
        { status: 400 }
      );
    }

    if (currentPin) {
      const isCurrentValid = await verifySuperAdminPin(currentPin);
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Current PIN is incorrect." },
          { status: 403 }
        );
      }
    }

    const result = await setSuperAdminPin(pinToSet);
    return NextResponse.json({
      success: true,
      message: result.savedToDb
        ? "Master PIN saved to Supabase Database successfully!"
        : "Master PIN saved to server configuration successfully!",
      savedToDb: result.savedToDb,
    });
  } catch (err: unknown) {
    console.error("Change PIN error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error updating PIN" },
      { status: 500 }
    );
  }
}

