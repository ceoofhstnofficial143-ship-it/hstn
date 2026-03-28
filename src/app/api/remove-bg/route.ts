import { NextRequest, NextResponse } from "next/server";

/**
 * 🎨 HSTNLX LUXURY IMAGE PROTOCOL
 * Integrated background removal using remove.bg API
 * Optimized for high-conversion white-background assets.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ success: false, message: "Missing Image URL" }, { status: 400 });
    }

    const rawKey = process.env.REMOVE_BG_API_KEY;
    const API_KEY = rawKey?.trim();

    if (!API_KEY) {
      console.error("CRITICAL: REMOVE_BG_API_KEY is missing or empty.");
      return NextResponse.json({ 
        success: false, 
        message: "Server configuration error" 
      }, { status: 500 });
    }

    // 🛡️ Remove Data URL prefix for remove.bg compatibility
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");

    const formData = new FormData();
    formData.append("image_file_b64", base64Data);
    formData.append("size", "auto");
    formData.append("bg_color", "white"); // Institutional White Background

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Remove.bg Error: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${base64Image}`,
    });
  } catch (error: any) {
    console.error("RemoveBG Error:", error.message);
    return NextResponse.json({ 
        success: false, 
        error: error.message 
    }, { status: 500 });
  }
}
