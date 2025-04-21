import { NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/google/callback`
);

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

    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email_verified) {
      return errorResponse('Email not verified');
    }

    // Construct PrimusResponse with attestation, using requests as an array
    const primusResponse = {
      result: true,
      params: {
        attestation: {
          verificationContent: 'Account ownership',
          verificationValue: payload.email,
          dataSourceId: 'google',
          attestationType: 'Humanity Verification',
          requestid: signResult.requestid || signResult.appId || 'unknown',
          signature: signResult.signature || undefined,
          algorithmType: signResult.algorithmType || 'proxytls',
          schemaType: 'http',
          requests: [
            {
              url: 'https://accounts.google.com/o/oauth2/v2/auth',
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              },
              queryString: `client_id=${process.env.GOOGLE_CLIENT_ID}&response_type=code&scope=email profile`,
              body: {},
              urlType: 'EXACT',
              response: {
                status: 200,
                headers: {},
                body: {}
              }
            }
          ]
        }
      }
    };

    return successResponse(primusResponse);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return errorResponse('Failed to verify Google account');
  }
}

function successResponse(primusResponse: any) {
  const html = `
    <html>
      <body>
        <script>
          window.opener.postMessage({
            type: 'GMAIL_VERIFICATION_RESULT',
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
            type: 'GMAIL_VERIFICATION_RESULT',
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
