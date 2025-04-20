import type { NextApiRequest, NextApiResponse } from 'next';
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';

const PRIMUS_APP_ID = "0x3416e33be9a4c37a7d31cd0e16cf5783c0f12002"; // Replace with your actual app ID
const PRIMUS_APP_SECRET = "0x4573da68c01751019166a5214b1cf886a909c488f11813975111c8d0215cf6a4";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { signParams } = req.body; // Expect signParams from the frontend

    // Validate signParams
    if (!signParams) {
      return res.status(400).json({ error: 'signParams is required' });
    }

    // Initialize SDK with app ID and secret
    const sdk = new PrimusZKTLS();
    await sdk.init(PRIMUS_APP_ID, PRIMUS_APP_SECRET);

    // Sign the attestation request
    const signResult = await sdk.sign(signParams);

    // Return the signed result
    res.status(200).json({ signResult });
  } catch (error) {
    console.error('Signing error:', error);
    res.status(500).json({
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

console.log("✅ sign.ts is running!");