import { NextRequest, NextResponse } from 'next/server';
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';
import { v4 as uuidv4 } from 'uuid';

const PRIMUS_APP_ID = '0x3416e33be9a4c37a7d31cd0e16cf5783c0f12002';
const PRIMUS_APP_SECRET = process.env.PRIMUS_APP_SECRET;

interface SignResult {
  requestid?: string;
  appId?: string;
  algorithmType?: string;
  signature?: string;
  appSignature?: string;
  attRequest?: any;
}

export async function POST(req: NextRequest) {
  console.log('🛠️ /api/sign POST handler triggered');

  try {
    if (!PRIMUS_APP_SECRET) {
      console.error('PRIMUS_APP_SECRET is not defined');
      return NextResponse.json({ error: 'Server configuration error: Missing PRIMUS_APP_SECRET' }, { status: 500 });
    }

    const body = await req.json();
    const { signParams } = body;
    console.log('Received signParams (raw):', signParams);

    if (!signParams) {
      console.log('Validation failed: signParams is missing');
      return NextResponse.json({ error: 'signParams is required' }, { status: 400 });
    }

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

    // Validate required fields (compatible with Binance KYC template)
    if (
      !parsedParams.appId ||
      !parsedParams.attTemplateID ||
      !parsedParams.userAddress ||
      !parsedParams.attMode ||
      !parsedParams.attMode.algorithmType ||
      !parsedParams.timestamp
    ) {
      console.log('Validation failed: Missing required fields in signParams');
      return NextResponse.json(
        { error: 'signParams missing required fields (appId, attTemplateID, userAddress, attMode, timestamp)' },
        { status: 400 }
      );
    }

    console.log('Initializing PrimusZKTLS SDK with appId:', PRIMUS_APP_ID);
    const sdk = new PrimusZKTLS();
    try {
      await sdk.init(PRIMUS_APP_ID, PRIMUS_APP_SECRET);
      console.log('SDK initialized successfully');
    } catch (initError) {
      console.error('SDK initialization failed:', initError);
      throw new Error(`SDK initialization failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
    }

    console.log('Calling sdk.sign with stringified parsedParams');
    const stringifiedParams = JSON.stringify(parsedParams);
    console.log('Stringified signParams for sdk.sign:', stringifiedParams);
    let rawSignResult;
    try {
      rawSignResult = await sdk.sign(stringifiedParams);
      console.log('Raw signResult (type):', typeof rawSignResult);
      console.log('Raw signResult (value):', rawSignResult);
    } catch (signError) {
      console.error('sdk.sign failed:', signError);
      throw new Error(`sdk.sign failed: ${signError instanceof Error ? signError.message : 'Unknown error'}`);
    }

    let signResult: SignResult;
    if (typeof rawSignResult === 'string') {
      try {
        signResult = JSON.parse(rawSignResult);
        console.log('Parsed signResult:', signResult);
      } catch (parseError) {
        console.error('Failed to parse signResult:', parseError);
        throw new Error('Invalid signResult format from sdk.sign');
      }
    } else {
      signResult = rawSignResult;
      console.log('signResult (object):', signResult);
    }

    if (!signResult.appSignature && !signResult.signature) {
      console.error('signResult missing required signature field:', {
        signature: signResult.signature,
        appSignature: signResult.appSignature,
        requestid: signResult.requestid,
        signResult,
      });
      throw new Error('sdk.sign returned incomplete signature data');
    }
    if (!signResult.requestid) {
      console.warn('signResult missing requestid, generating a new one');
    }

    const enhancedSignResult = {
      requestid: signResult.requestid || uuidv4(),
      appId: signResult.appId || parsedParams.appId,
      algorithmType: signResult.algorithmType || parsedParams.attMode?.algorithmType || 'proxytls',
      signature: signResult.appSignature || signResult.signature,
      attRequest: parsedParams,
    };
    console.log('Enhanced signResult:', enhancedSignResult);

    return NextResponse.json({ signResult: enhancedSignResult }, { status: 200 });
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