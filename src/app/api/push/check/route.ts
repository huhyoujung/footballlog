import { NextResponse } from "next/server";

export async function GET() {
  const hasPublicKey = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const hasPrivateKey = !!process.env.VAPID_PRIVATE_KEY;

  return NextResponse.json({
    vapidConfigured: hasPublicKey && hasPrivateKey,
    publicKeySet: hasPublicKey,
    privateKeySet: hasPrivateKey,
    publicKeyLength: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.length || 0,
  });
}
