'use client';

import { useState, useEffect } from 'react';
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, Check, X, Moon, Sun } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import './Home.css';

const APP_ID = '0x3416e33be9a4c37a7d31cd0e16cf5783c0f12002';
const BINANCE_KYC_TEMPLATE_ID = '9859330b-b94f-47a4-8f13-0ca56dabe273'; // Updated to Binance KYC template ID

interface ExtensionAttestationResult {
  result: boolean;
  data?: any;
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
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null); // Changed to store userId
  const [kycStatus, setKycStatus] = useState<string | null>(null); // Added to store KYC status

  const primusZKTLS = new PrimusZKTLS();

  // Initialize SDK
  useEffect(() => {
    const initSDK = async () => {
      try {
        const result = await primusZKTLS.init(APP_ID);
        console.log('Primus ZKTLS initialized successfully:', result);
        setIsSDKInitialized(primusZKTLS.isInitialized);
      } catch (error: any) {
        console.error('SDK initialization error:', {
          message: error.message,
          code: error.code,
          stack: error.stack,
        });
        setIsSDKInitialized(false);
        toast({
          title: 'Initialization Error',
          description: 'Primus extension not detected. Please ensure it is installed and enabled.',
          variant: 'destructive',
        });
      }
    };
    initSDK();
  }, []);

  // Handle extension messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      // Handle Primus extension messages
      if (event.data.target === 'padoZKAttestationJSSDK') {
        const params: ExtensionAttestationResult = event.data.params;
        console.log(`Received ${event.data.name}:`, params);
        if (event.data.name === 'initAttestationRes') {
          console.log('initAttestationRes details:', {
            result: params.result,
            data: params.data,
            isInitialized: primusZKTLS.isInitialized,
          });
        } else if (event.data.name === 'getAttestationRes') {
          if (!params.result && params.errorData) {
            console.error('Attestation error:', params.errorData);
            setVerificationStatus('failed');
            setVerificationError(params.errorData.desc || 'Attestation failed');
            setVerifiedUserId(null);
            setKycStatus(null);
            toast({
              title: 'Verification Error',
              description: params.errorData.desc || 'Attestation failed',
              variant: 'destructive',
            });
          }
        } else if (event.data.name === 'startAttestationRes') {
          if (params.result && params.data) {
            try {
              console.log('Verifying attestation:', params.data);
              const verifyResult = primusZKTLS.verifyAttestation(params.data);
              if (verifyResult) {
                // Extract userId and kycStatus from attestation data
                const attestationData = JSON.parse(params.data.data || '{}');
                const userId = attestationData['userId'] || 'Unknown user';
                const kycStatus = attestationData['kycStatus'] || 'Unknown status';
                setVerifiedUserId(userId);
                setKycStatus(kycStatus);
                setVerificationStatus('verified');
                toast({
                  title: 'Binance KYC Verified',
                  description: `Binance KYC for user ${userId} verified with status: ${kycStatus}`,
                  variant: 'default',
                });
              } else {
                throw new Error('Attestation verification failed');
              }
            } catch (error: any) {
              console.error('Attestation verification error:', {
                message: error.message,
                stack: error.stack,
              });
              setVerificationStatus('failed');
              setVerificationError(error.message || 'Verification failed');
              setVerifiedUserId(null);
              setKycStatus(null);
              toast({
                title: 'Verification Error',
                description: error.message || 'Verification failed',
                variant: 'destructive',
              });
            }
          } else if (params.errorData) {
            console.error('Attestation error:', params.errorData);
            setVerificationStatus('failed');
            setVerificationError(params.errorData.desc || 'Attestation failed');
            setVerifiedUserId(null);
            setKycStatus(null);
            toast({
              title: 'Verification Error',
              description: params.errorData.desc || 'Attestation failed',
              variant: 'destructive',
            });
          }
        }
      }

      // Handle Binance KYC verification result (if applicable)
      if (event.data.type === 'BINANCE_KYC_VERIFICATION_RESULT') {
        console.log('Received BINANCE_KYC_VERIFICATION_RESULT:', event.data);
        if (event.data.success && event.data.params?.attestation) {
          try {
            const { attestation } = event.data.params;
            console.log('Verifying Binance KYC attestation:', attestation);
            const verifyResult = primusZKTLS.verifyAttestation(attestation);
            if (verifyResult) {
              const userId = attestation.userId || 'Unknown user';
              const kycStatus = attestation.kycStatus || 'Unknown status';
              setVerifiedUserId(userId);
              setKycStatus(kycStatus);
              setVerificationStatus('verified');
              toast({
                title: 'Binance KYC Verified',
                description: `Binance KYC for user ${userId} verified with status: ${kycStatus}`,
                variant: 'default',
              });
            } else {
              throw new Error('Attestation verification failed');
            }
          } catch (error: any) {
            console.error('Verification error:', {
              message: error.message,
              stack: error.stack,
            });
            setVerificationStatus('failed');
            setVerificationError(error.message || 'Verification failed');
            setVerifiedUserId(null);
            setKycStatus(null);
            toast({
              title: 'Verification Error',
              description: error.message || 'Verification failed',
              variant: 'destructive',
            });
          }
        } else {
          setVerificationStatus('failed');
          setVerificationError(event.data.error || 'Binance KYC verification failed');
          setVerifiedUserId(null);
          setKycStatus(null);
          toast({
            title: 'Verification Error',
            description: event.data.error || 'Binance KYC verification failed',
            variant: 'destructive',
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const directBinanceKYCVerification = async () => {
    try {
      // Check if extension is available
      if (!window.primus) {
        throw new Error('Primus extension not detected. Please install it.');
      }
      console.log('Primus extension detected:', window.primus);

      // Reinitialize SDK if not initialized
      if (!primusZKTLS.isInitialized) {
        console.log('SDK not initialized, reinitializing...');
        await primusZKTLS.init(APP_ID);
        console.log('SDK reinitialized, isInitialized:', primusZKTLS.isInitialized);
        setIsSDKInitialized(primusZKTLS.isInitialized);
        if (!primusZKTLS.isInitialized) {
          throw new Error('Failed to reinitialize SDK');
        }
      }

      // Generate request for Binance KYC
      const request = primusZKTLS.generateRequestParams(BINANCE_KYC_TEMPLATE_ID, '0x0000000000000000000000000000000000000000');
      request.setAttMode({
        algorithmType: 'proxytls',
        resultType: 'plain',
        withExtension: true,
        httpRequests: [{
          url: 'https://www.binance.com/bapi/kyc/v2/private/certificate/user-kyc/current-kyc-status',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          queryString: '', // Adjust if Binance API requires specific query parameters
          body: {},
          urlType: 'EXACT',
        }],
      });
      request.appId = APP_ID;
      console.log('Generated request params:', request);

      // Sign the request
      const signResponse = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signParams: JSON.stringify(request) }),
      });

      if (!signResponse.ok) {
        const errorData = await signResponse.json();
        console.error('Sign response error:', errorData);
        throw new Error(errorData.error || 'Failed to sign attestation parameters');
      }

      const { signResult } = await signResponse.json();
      console.log('Received signResult:', signResult);

      if (!signResult.signature || !signResult.requestid) {
        throw new Error('Invalid signResult structure from /api/sign');
      }

      // Ensure signResult uses appSignature for compatibility
      const attestationParams = {
        ...signResult,
        appSignature: signResult.signature, // Map signature to appSignature
      };
      console.log('Prepared attestation params:', attestationParams);

      // Verify SDK initialization state
      console.log('SDK isInitialized before startAttestation:', primusZKTLS.isInitialized);
      if (!primusZKTLS.isInitialized) {
        throw new Error('SDK not initialized before starting attestation');
      }

      // Start attestation with extension
      setVerificationStatus('verifying');
      console.log('Starting attestation with params:', attestationParams);
      const attestation = await primusZKTLS.startAttestation(JSON.stringify(attestationParams));
      console.log('Attestation result:', attestation);
    } catch (error: any) {
      console.error('Verification error:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        data: error.data,
      });
      setVerificationStatus('failed');
      setVerificationError(error.message || 'Verification failed. Please check the console for details.');
      setVerifiedUserId(null);
      setKycStatus(null);
      toast({
        title: 'Verification Error',
        description: error.message || 'Verification failed. Please check the console for details.',
        variant: 'destructive',
      });
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
    setVerifiedUserId(null);
    setKycStatus(null);
    await directBinanceKYCVerification();
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
          {verifiedUserId && kycStatus ? (
            <div className="verified-status">
              <Check className="verified-icon" />
              <p className="verified-text">Verified: User {verifiedUserId} with KYC Status: {kycStatus}</p>
            </div>
          ) : (
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
          )}
        </div>
      </div>

      <Dialog
        open={verificationStatus !== 'idle'}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setVerificationStatus('idle');
            setVerificationError(null);
            setVerifiedUserId(null);
            setKycStatus(null);
          }
        }}
      >
        <DialogContent className="dialog-content" aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle className="dialog-title">Binance KYC Verification</DialogTitle>
          </DialogHeader>
          <div id="dialog-description" className="sr-only">
            Dialog for displaying the status of Binance KYC verification process
          </div>
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
                <p className="status-text">
                  Binance KYC verified successfully! {verifiedUserId ? `User: ${verifiedUserId}` : ''} {kycStatus ? `Status: ${kycStatus}` : ''}
                </p>
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