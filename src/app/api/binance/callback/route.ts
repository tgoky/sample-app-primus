import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return errorResponse('Missing code or state parameters');
  }

  try {
    // Decode and parse the state parameter (contains signed attestation)
    let signResult;
    try {
      signResult = JSON.parse(decodeURIComponent(state));
    } catch (error) {
      return errorResponse('Invalid state parameter');
    }

    // Note: Replace this with actual Binance API call if needed
    // For now, assume Primus extension provides attestation data
    const attestation = {
      verificationContent: 'Binance KYC Verification',
      verificationValue: { userId: 'sampleUserId', kycStatus: 'APPROVED' }, // Replace with actual data
      dataSourceId: 'binance',
      attestationType: 'KYC Verification',
      requestid: signResult.requestid || signResult.appId || 'unknown',
      signature: signResult.signature || undefined,
      algorithmType: signResult.algorithmType || 'proxytls',
      requests: [
        {
          url: 'https://www.binance.com/bapi/kyc/v2/private/certificate/user-kyc/current-kyc-status',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          queryString: '', // Adjust if query parameters are needed
          body: {},
          urlType: 'EXACT',
          response: {
            status: 200,
            headers: {},
            body: { data: { userId: 'sampleUserId', kycStatus: 'APPROVED' } }, // Mock response
          },
        },
      ],
    };

    const primusResponse = {
      result: true,
      params: { attestation },
    };

    return successResponse(primusResponse);
  } catch (error) {
    console.error('Binance KYC verification error:', error);
    return errorResponse('Failed to verify Binance KYC');
  }
}

function successResponse(primusResponse: any) {
  const html = `
    <html>
      <body>
        <script>
          window.opener.postMessage({
            type: 'BINANCE_KYC_VERIFICATION_RESULT',
            success: true,
            ${JSON.stringify(primusResponse).slice(1, -1)}
          }, '${process.env.NEXTAUTH_URL}');
          window.close();
        </script>
      </body>
    </html>
  `;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

function errorResponse(message: string) {
  const html = `
    <html>
      <body>
        <script>
          window.opener.postMessage({
            type: 'BINANCE_KYC_VERIFICATION_RESULT',
            success: false,
            error: '${message}'
          }, '${process.env.NEXTAUTH_URL}');
          window.close();
        </script>
      </body>
    </html>
  `;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
    status: 400,
  });
}