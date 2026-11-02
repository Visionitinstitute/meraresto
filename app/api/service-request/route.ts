import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface ServiceRequestRecord {
  id: string;
  hotel_id: string;
  table_number: number;
  request_type: "call_waiter" | "water" | "bill" | "cutlery" | "clean" | "other";
  diner_name?: string | null;
  note?: string | null;
  status: "active" | "attended" | "cancelled";
  created_at: string;
}

// In-memory store for fast multi-tenant active service requests
// Persists active table calls during service
const activeRequestsStore = new Map<string, ServiceRequestRecord[]>();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hotelId = searchParams.get("hotel_id");

    if (!hotelId) {
      return NextResponse.json({ error: "hotel_id is required" }, { status: 400 });
    }

    const hotelRequests = activeRequestsStore.get(hotelId) || [];
    // Only return requests from the last 2 hours that are active
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const filtered = hotelRequests.filter(
      (r) => r.status === "active" && new Date(r.created_at).getTime() > twoHoursAgo
    );

    return NextResponse.json({ success: true, requests: filtered });
  } catch (err: unknown) {
    console.error("GET service-request error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      hotel_id,
      table_number,
      request_type = "call_waiter",
      diner_name,
      note,
    } = body;

    if (!hotel_id || !table_number) {
      return NextResponse.json(
        { error: "hotel_id and table_number are required" },
        { status: 400 }
      );
    }

    const tableNum = Number(table_number);
    if (isNaN(tableNum) || tableNum <= 0) {
      return NextResponse.json({ error: "Invalid table number" }, { status: 400 });
    }

    const newRequest: ServiceRequestRecord = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      hotel_id,
      table_number: tableNum,
      request_type,
      diner_name: diner_name ? String(diner_name).trim() : null,
      note: note ? String(note).trim() : null,
      status: "active",
      created_at: new Date().toISOString(),
    };

    const currentList = activeRequestsStore.get(hotel_id) || [];
    // Prepend new request, keep max 50 recent requests per hotel
    activeRequestsStore.set(hotel_id, [newRequest, ...currentList.slice(0, 49)]);

    return NextResponse.json({
      success: true,
      request: newRequest,
      message: `Table #${tableNum} service request dispatched to restaurant staff`,
    });
  } catch (err: unknown) {
    console.error("POST service-request error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { request_id, hotel_id, status = "attended" } = body;

    if (!request_id || !hotel_id) {
      return NextResponse.json(
        { error: "request_id and hotel_id are required" },
        { status: 400 }
      );
    }

    const currentList = activeRequestsStore.get(hotel_id) || [];
    const updated = currentList.map((req) =>
      req.id === request_id ? { ...req, status: status as "attended" | "cancelled" } : req
    );
    activeRequestsStore.set(hotel_id, updated);

    return NextResponse.json({ success: true, message: `Request marked as ${status}` });
  } catch (err: unknown) {
    console.error("PATCH service-request error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

