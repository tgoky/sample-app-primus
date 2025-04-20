// src/app/api/sign/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';

const PRIMUS_APP_ID = "0x3416e33be9a4c37a7d31cd0e16cf5783c0f12002";
const PRIMUS_APP_SECRET = "0x4573da68c01751019166a5214b1cf886a909c488f11813975111c8d0215cf6a4";

export async function POST(req: NextRequest) {
  console.log("🛠️ /api/sign POST handler triggered");

  try {
    // Parse request body
    const body = await req.json();
    const { signParams } = body;
    console.log("Received signParams (raw):", signParams);

    // Validate signParams
    if (!signParams) {
      console.log("Validation failed: signParams is missing");
      return NextResponse.json({ error: 'signParams is required' }, { status: 400 });
    }

    // Parse signParams if it's a string
    let parsedParams;
    try {
      parsedParams = typeof signParams === 'string' ? JSON.parse(signParams) : signParams;
      console.log("Parsed signParams:", parsedParams);
    } catch (parseError) {
      console.error("Failed to parse signParams:", parseError);
      return NextResponse.json(
        { error: 'Invalid signParams format', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
        { status: 400 }
      );
    }

    // Validate parsedParams structure
    if (!parsedParams.appId || !parsedParams.attTemplateID || !parsedParams.userAddress || !parsedParams.timestamp) {
      console.log("Validation failed: Missing required fields in signParams");
      return NextResponse.json(
        { error: 'signParams missing required fields (appId, attTemplateID, userAddress, timestamp)' },
        { status: 400 }
      );
    }

    // Initialize SDK
    console.log("Initializing PrimusZKTLS SDK with appId:", PRIMUS_APP_ID);
    const sdk = new PrimusZKTLS();
    try {
      await sdk.init(PRIMUS_APP_ID, PRIMUS_APP_SECRET);
      console.log("SDK initialized successfully");
    } catch (initError) {
      console.error("SDK initialization failed:", initError);
      throw new Error(`SDK initialization failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
    }

    // Sign the attestation request
    console.log("Calling sdk.sign with stringified parsedParams");
    const stringifiedParams = JSON.stringify(parsedParams);
    console.log("Stringified parsedParams:", stringifiedParams);
    const signResult = await sdk.sign(stringifiedParams);
    console.log("Sign result:", signResult);

    // Return the signed result
    return NextResponse.json({ signResult }, { status: 200 });
  } catch (error) {
    console.error('Signing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}