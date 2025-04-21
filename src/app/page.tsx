'use client';
import { useState, useEffect } from 'react';
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, Check, X, Moon, Sun } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import './Home.css';

// Configuration
const APP_ID = process.env.NEXT_PUBLIC_PRIMUS_APP_ID || '0x3416e33be9a4c37a7d31cd0e16cf5783c0f12002';
const GMAIL_TEMPLATE_ID = process.env.NEXT_PUBLIC_GMAIL_TEMPLATE_ID || '77a68f69-69bc-4247-a44e-b503c6379769';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '406436486558-ng8vhi2pg691d38jh0q8l31f7o5nlruu.apps.googleusercontent.com';

// Home.tsx (only showing updated parts)
interface PrimusResponse {
  result: boolean;
  params?: {
    attestation: {
      verificationContent: string;
      verificationValue: string;
      dataSourceId: string;
      attestationType: string;
      requestid?: string;
      signature?: string;
      algorithmType?: string;
      schemaType?: string;
      requests?: Array<{
        url: string;
        method: string;
        headers: Record<string, string>;
        queryString?: string;
        body?: Record<string, unknown>; // Changed from any to unknown
        urlType?: string;
        response?: {
          status: number;
          headers: Record<string, string>;
          body: Record<string, unknown>; // Changed from any to unknown
        };
      }>;
    };
  };
  errorData?: {
    code: string;
    desc: string;
  };
}

export default function Home() {
  const { toast } = useToast();
  const [isSDKInitialized, setIsSDKInitialized] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize Primus ZKTLS SDK
  const primusZKTLS = new PrimusZKTLS();

  useEffect(() => {
    const initSDK = async () => {
      try {
        const initResult = await primusZKTLS.init(APP_ID);
        console.log('Primus ZKTLS init result:', initResult);
        setIsSDKInitialized(true);
      } catch (error: any) {
        console.error('SDK initialization error:', error);
        setIsSDKInitialized(false);
      }
    };
    initSDK();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data.type !== 'GMAIL_VERIFICATION_RESULT') {
        return;
      }
      console.log('Received GMAIL_VERIFICATION_RESULT:', event.data);
      if (event.data.success) {
        try {
          completeVerification(event.data);
        } catch (error: any) {
          console.error('Complete verification error:', error);
          setVerificationStatus('failed');
          setVerificationError(error.message || 'Verification failed');
          toast({
            title: 'Verification Error',
            description: error.message || 'Verification failed',
            variant: 'destructive',
          });
        }
      } else {
        setVerificationStatus('failed');
        setVerificationError(event.data.error || 'Gmail verification failed');
        toast({
          title: 'Verification Error',
          description: event.data.error || 'Gmail verification failed',
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const directGmailVerification = async () => {
    try {
      // Generate attestation parameters using Primus ZKTLS
      const request = primusZKTLS.generateRequestParams(GMAIL_TEMPLATE_ID, 'verification');
      request.setAttMode({ algorithmType: 'proxytls', resultType: 'plain' });
      request.appId = APP_ID;

      // Sign the attestation parameters
      const signResponse = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signParams: JSON.stringify(request) }),
      });

      if (!signResponse.ok) {
        throw new Error('Failed to sign attestation parameters');
      }

      const { signResult } = await signResponse.json();

      // Open Google OAuth popup
      const popup = window.open(
        `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${GOOGLE_CLIENT_ID}&` +
          'response_type=code&' +
          'scope=email profile&' +
          `redirect_uri=${window.location.origin}/api/google/callback&` +
          `state=${encodeURIComponent(JSON.stringify(signResult))}`,
        '_blank',
        'width=500,height=600'
      );

      if (!popup) {
        throw new Error('Failed to open verification popup');
      }

      setVerificationStatus('verifying');
    } catch (error: any) {
      console.error('Direct verification error:', error);
      setVerificationStatus('failed');
      setVerificationError(error.message || 'Verification failed');
      toast({
        title: 'Verification Error',
        description: error.message || 'Verification failed',
        variant: 'destructive',
      });
    }
  };

  const completeVerification = (response: PrimusResponse) => {
    console.log('completeVerification response:', response);
    if (!response || !response.result || !response.params?.attestation) {
      throw new Error('Invalid verification response');
    }
  
    const { attestation } = response.params;
    console.log('Attestation object:', attestation);
  
    // Ensure the attestation has the required structure
    const attestationWithRequests = {
      ...attestation,
      schemaType: attestation.schemaType || 'http',
      requests: [
        {
          url: 'https://accounts.google.com/o/oauth2/v2/auth',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          queryString: `client_id=${GOOGLE_CLIENT_ID}&response_type=code&scope=email profile`,
          body: {},
          urlType: 'EXACT',
          response: {
            status: 200,
            headers: {},
            body: {}
          }
        }
      ]
    };
  
    console.log('Attestation with requests:', attestationWithRequests);
    
    try {
      const verifyResult = primusZKTLS.verifyAttestation(attestationWithRequests);
      if (verifyResult) {
        setVerificationStatus('verified');
        toast({
          title: 'Gmail Verified',
          description: 'Your Gmail account has been successfully verified!',
          variant: 'default',
        });
      } else {
        throw new Error('Attestation verification failed');
      }
    } catch (error: any) {
      console.error('Attestation verification error:', error);
      throw new Error(`Attestation verification failed: ${error.message}`);
    }
  };
  

  const verifyIdentity = async () => {
    if (!isSDKInitialized) {
      toast({
        title: 'Error',
        description: 'Verification system not initialized',
        variant: 'destructive',
      });
      return;
    }

    setVerificationError(null);
    await directGmailVerification();
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <button className="theme-toggle" onClick={toggleTheme}>
        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>
      <div className="card">
        <h1 className="card-title">Gmail Verification</h1>
        <div className="card-content">
          <Button
            onClick={verifyIdentity}
            disabled={verificationStatus === 'verifying'}
            className={`verify-button ${verificationStatus === 'verifying' ? 'verifying' : ''}`}
          >
            {verificationStatus === 'verifying' ? (
              <span className="button-content">
                <Clock className="button-icon" />
                Verifying...
              </span>
            ) : (
              'Verify Gmail Account'
            )}
          </Button>
        </div>
      </div>

      <Dialog
        open={verificationStatus !== 'idle'}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setVerificationStatus('idle');
            setVerificationError(null);
          }
        }}
      >
        <DialogContent className="dialog-content">
          <DialogHeader>
            <DialogTitle className="dialog-title">Gmail Verification</DialogTitle>
          </DialogHeader>
          <div className="dialog-body">
            {verificationStatus === 'verifying' && (
              <>
                <div className="status-icon verifying">
                  <Clock className="icon" />
                </div>
                <p className="status-text">Please complete verification in the popup window</p>
              </>
            )}
            {verificationStatus === 'verified' && (
              <>
                <div className="status-icon verified">
                  <Check className="icon" />
                </div>
                <p className="status-text">Gmail verified successfully!</p>
                <Button onClick={() => setVerificationStatus('idle')} className="action-button">
                  Close
                </Button>
              </>
            )}
            {verificationStatus === 'failed' && (
              <>
                <div className="status-icon failed">
                  <X className="icon" />
                </div>
                <p className="status-text error">{verificationError || 'Verification failed'}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setVerificationStatus('idle');
                    verifyIdentity();
                  }}
                  className="action-button outline"
                >
                  Try Again
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}