import { NextRequest, NextResponse } from 'next/server';
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';
import { v4 as uuidv4 } from 'uuid'; // For generating unique requestid

const PRIMUS_APP_ID = '0x3416e33be9a4c37a7d31cd0e16cf5783c0f12002';
const PRIMUS_APP_SECRET = '0x4573da68c01751019166a5214b1cf886a909c488f11813975111c8d0215cf6a4';

export async function POST(req: NextRequest) {
  console.log('🛠️ /api/sign POST handler triggered');

  try {
    // Parse request body
    const body = await req.json();
    const { signParams } = body;
    console.log('Received signParams (raw):', signParams);

    // Validate signParams
    if (!signParams) {
      console.log('Validation failed: signParams is missing');
      return NextResponse.json({ error: 'signParams is required' }, { status: 400 });
    }

    // Parse signParams if it's a string
    let parsedParams;
    try {
      parsedParams = typeof signParams === 'string' ? JSON.parse(signParams) : signParams;
      console.log('Parsed signParams:', parsedParams);
    } catch (parseError) {
      console.error('Failed to parse signParams:', parseError);
      return NextResponse.json(
        { error: 'Invalid signParams format', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
        { status: 400 }
      );
    }

    // Relaxed validation to match generateRequestParams output
    if (!parsedParams.appId || !parsedParams.attTemplateID) {
      console.log('Validation failed: Missing required fields in signParams (appId, attTemplateID)');
      return NextResponse.json(
        { error: 'signParams missing required fields (appId, attTemplateID)' },
        { status: 400 }
      );
    }

    // Initialize SDK
    console.log('Initializing PrimusZKTLS SDK with appId:', PRIMUS_APP_ID);
    const sdk = new PrimusZKTLS();
    try {
      await sdk.init(PRIMUS_APP_ID, PRIMUS_APP_SECRET);
      console.log('SDK initialized successfully');
    } catch (initError) {
      console.error('SDK initialization failed:', initError);
      throw new Error(`SDK initialization failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
    }

    // Sign the attestation request
    console.log('Calling sdk.sign with stringified parsedParams');
    const stringifiedParams = JSON.stringify(parsedParams);
    console.log('Stringified parsedParams:', stringifiedParams);
    const rawSignResult = await sdk.sign(stringifiedParams);
    console.log('Raw signResult:', rawSignResult);

    // Handle signResult (string or object)
    let signResult: any;
    if (typeof rawSignResult === 'string') {
      try {
        signResult = JSON.parse(rawSignResult); // Attempt to parse if JSON string
        console.log('Parsed signResult:', signResult);
      } catch (parseError) {
        console.log('signResult is a plain string, treating as signature');
        signResult = { signature: rawSignResult }; // Treat as signature
      }
    } else {
      signResult = rawSignResult; // Use as-is if already an object
      console.log('signResult (object):', signResult);
    }

    // Ensure signResult is an object
    const enhancedSignResult = {
      requestid: signResult.requestid || uuidv4(), // Fallback to UUID
      appId: signResult.appId || parsedParams.appId,
      algorithmType: signResult.algorithmType || parsedParams.algorithmType || 'proxytls',
      signature: signResult.signature || 'mock-signature', // Fallback
      ...(typeof signResult === 'object' ? signResult : {}) // Spread only if object
    };
    console.log('Enhanced signResult:', enhancedSignResult);

    // Return the signed result
    return NextResponse.json({ signResult: enhancedSignResult }, { status: 200 });
  } catch (error) {
    console.error('Signing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}