// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, Check, X, Moon, Sun } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import './Home.css'; // Import custom CSS

// Configuration
const PRIMUS_EXTENSION_ID = process.env.NEXT_PUBLIC_PRIMUS_EXTENSION_ID || 'dechfgbdbnjhabdpjohaelfaipjfpfnh';
const APP_ID = process.env.NEXT_PUBLIC_PRIMUS_APP_ID || '0x3416e33be9a4c37a7d31cd0e16cf5783c0f12002';
const BINANCE_KYC_TEMPLATE_ID = process.env.NEXT_PUBLIC_BINANCE_KYC_TEMPLATE_ID || '9859330b-b94f-47a4-8f13-0ca56dabe273';

interface PrimusResponse {
  result: boolean;
  params?: {
    attestation: {
      verificationContent: string;
      verificationValue: string;
      dataSourceId: string;
      attestationType: string;
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
        toast({
          title: 'Initialization Successful',
          description: 'KYC verification system is ready.',
          variant: 'default',
        });
      } catch (error: any) {
        console.error('SDK initialization error:', error);
        toast({
          title: 'Initialization Error',
          description: 'Failed to initialize KYC verification. Please ensure the Primus extension is installed.',
          variant: 'destructive',
        });
        setIsSDKInitialized(false);
      }
    };
    initSDK();
  }, [toast]);

  const verifyIdentity = async () => {
    if (typeof window === 'undefined') {
      toast({
        title: 'Error',
        description: 'This feature requires a browser environment.',
        variant: 'destructive',
      });
      return;
    }

    if (!isSDKInitialized) {
      toast({
        title: 'Error',
        description: 'KYC verification system is not initialized. Please try again later.',
        variant: 'destructive',
      });
      return;
    }

    setVerificationStatus('verifying');
    setVerificationError(null);

    try {
      const request = primusZKTLS.generateRequestParams(BINANCE_KYC_TEMPLATE_ID, 'verification');
      request.setAttMode({ algorithmType: 'proxytls', resultType: 'plain' });
      // Ensure appId is set
      request.appId = APP_ID;
      console.log("Generated signParams:", JSON.stringify(request, null, 2));

      // Send attestation parameters to the backend for signing
      const signResponse = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signParams: JSON.stringify(request) }), // Stringify signParams
      });

      if (!signResponse.ok) {
        let errorMessage = 'Failed to sign attestation parameters';
        if (signResponse.status === 404) {
          errorMessage = 'API endpoint /api/sign not found. Please check server configuration.';
        } else if (signResponse.status === 405) {
          errorMessage = 'Method not allowed for /api/sign. Ensure the API supports POST requests.';
        } else {
          try {
            const errorData = await signResponse.json();
            errorMessage = errorData.details || errorData.error || errorMessage;
          } catch (e) {
            errorMessage = `Server error: ${signResponse.status} ${signResponse.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const { signResult } = await signResponse.json();
      console.log('Signed attestation parameters:', signResult);

      console.log('Sending attestation request to extension:', {
        extensionId: PRIMUS_EXTENSION_ID,
        message: {
          type: 'padoZKAttestationJSSDK',
          name: 'startAttestation',
          params: {
            ...signResult, // Use signed parameters from the backend
            sdkVersion: '1',
            dappSymbol: 'KycTestApp',
          },
        },
      });

      const attestationResponse: PrimusResponse = await new Promise((resolve, reject) => {
        window.chrome.runtime.sendMessage(
          PRIMUS_EXTENSION_ID,
          {
            type: 'padoZKAttestationJSSDK',
            name: 'startAttestation',
            params: {
              ...signResult, // Use signed parameters
              sdkVersion: '1',
              dappSymbol: 'KycTestApp',
            },
          },
          (response: PrimusResponse) => {
            console.log('Extension response:', response);
            if (window.chrome.runtime.lastError) {
              console.error('Chrome runtime error:', window.chrome.runtime.lastError);
              reject(new Error(`Extension communication failed: ${window.chrome.runtime.lastError.message}`));
            } else if (!response) {
              reject(new Error('No response received from Primus extension. Ensure it is loaded and running at chrome-extension://dechfgbdbnjhabdpjohaelfaipjfpfnh/home.html#/home.'));
            } else if (response.result === false) {
              reject(new Error(`Attestation failed: ${response.errorData?.desc} (Code: ${response.errorData?.code})`));
            } else {
              resolve(response);
            }
          }
        );
      });

      console.log('Binance KYC attestation response:', attestationResponse);

      const errorMap: { [key: string]: string } = {
        '00002': 'The verification process timed out. Please ensure you are logged into Binance and try again.',
        '00103': 'Invalid verification data. Please try again or contact support.',
        '00104': 'Your Binance account does not have KYC verification. Please complete KYC on Binance: https://www.binance.com/en/my/settings/kyc',
        '00003': 'Another verification is in progress. Please wait and try again.',
        '00012': 'Invalid KYC template. Please contact support.',
        '00009': 'This website is not authorized for KYC verification. Please contact support.',
        '00006': 'Primus extension not detected. Please ensure it is loaded in Chrome Developer Mode at chrome-extension://dechfgbdbnjhabdpjohaelfaipjfpfnh/home.html#/home.',
      };

      if (attestationResponse.result) {
        const { attestation } = attestationResponse.params!;
        const verifyResult = primusZKTLS.verifyAttestation(attestation);
        if (!verifyResult) {
          throw new Error('Attestation signature verification failed.');
        }

        if (
          attestation.verificationContent === 'KYC Status' &&
          attestation.verificationValue === 'Basic Verification' &&
          attestation.dataSourceId === 'binance' &&
          attestation.attestationType === 'Humanity Verification'
        ) {
          setVerificationStatus('verified');
          toast({
            title: 'KYC Verified',
            description: 'Your Binance KYC status has been successfully verified!',
            variant: 'default',
          });
        } else {
          throw new Error('Invalid attestation: does not match Binance KYC criteria.');
        }
      } else {
        const errorCode = attestationResponse.errorData!.code;
        const errorMessage = errorMap[errorCode] || `Verification failed: ${attestationResponse.errorData!.desc}`;
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('KYC verification error:', error);
      let errorMessage = error.message || 'Failed to verify KYC status.';

      if (
        errorMessage.includes('Extension communication failed') ||
        errorMessage.includes('No response received from Primus extension')
      ) {
        errorMessage = 'Primus extension not detected. Please ensure it is loaded in Chrome Developer Mode at chrome-extension://dechfgbdbnjhabdpjohaelfaipjfpfnh/home.html#/home.';
      }

      setVerificationStatus('failed');
      setVerificationError(errorMessage);
      toast({
        title: 'Verification Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
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
        <h1 className="card-title">Binance KYC Verification</h1>
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
              'Verify Binance KYC'
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
            <DialogTitle className="dialog-title">Verify Your Identity</DialogTitle>
          </DialogHeader>
          <div className="dialog-body">
            {verificationStatus === 'verifying' && (
              <>
                <div className="status-icon verifying">
                  <Clock className="icon" />
                </div>
                <p className="status-text">
                  Verifying your Binance KYC status... Please ensure you are logged into Binance.
                </p>
              </>
            )}
            {verificationStatus === 'verified' && (
              <>
                <div className="status-icon verified">
                  <Check className="icon" />
                </div>
                <p className="status-text">Identity verified successfully!</p>
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
                {verificationError?.includes('Please complete KYC on Binance') && (
                  <a
                    href="https://www.binance.com/en/my/settings/kyc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link"
                  >
                    Complete Binance KYC
                  </a>
                )}
                <Button
                  variant="outline"
                  onClick={() => setVerificationStatus('idle')}
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