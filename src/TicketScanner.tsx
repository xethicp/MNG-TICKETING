import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Ticket,
  XCircle,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';

type ScanState =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'checking'
  | 'valid'
  | 'used'
  | 'invalid'
  | 'error';

type ScanResult = {
  valid?: boolean;
  already_used?: boolean;
  ticket_number?: string;
  event_name?: string;
  pass_name?: string;
  checked_in_at?: string;
  error?: string;
};

export default function TicketScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);

  const [state, setState] = useState<ScanState>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState('');

  const stopScanner = async () => {
    const scanner = scannerRef.current;

    if (!scanner) return;

    try {
      const scannerState = scanner.getState();

      if (scannerState === 2) {
        await scanner.stop();
      }
    } catch {
      // Camera may already be stopped.
    }

    try {
      scanner.clear();
    } catch {
      // Scanner may already be cleared.
    }

    scannerRef.current = null;
  };

  const checkTicket = async (qrToken: string) => {
    if (processingRef.current) return;

    processingRef.current = true;

    setState('checking');
    setMessage('Verifying ticket…');
    setResult(null);

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured.');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your staff session has expired. Please sign in again.');
      }

      const response = await fetch(
        '/.netlify/functions/check-in-ticket',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            qr_token: qrToken.trim(),
          }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as ScanResult;

      setResult(data);

      if (response.ok && data.valid) {
        setState('valid');
        setMessage('ENTRY ACCEPTED');
      } else if (response.status === 409 && data.already_used) {
        setState('used');
        setMessage('ALREADY USED');
      } else {
        setState('invalid');
        setMessage(data.error || 'TICKET NOT VALID');
      }
    } catch (error) {
      setState('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to verify ticket.',
      );
    } finally {
      processingRef.current = false;
    }
  };

  const startScanner = async () => {
    setCameraError('');
    setResult(null);
    setMessage('');
    processingRef.current = false;

    await stopScanner();

    setState('starting');

    try {
      const scanner = new Html5Qrcode('mng-ticket-reader');

      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: {
            width: 260,
            height: 260,
          },
          aspectRatio: 1,
        },
        async (decodedText) => {
          if (processingRef.current) return;

          await stopScanner();
          await checkTicket(decodedText);
        },
        () => {
          // Ignore normal camera scan misses.
        },
      );

      if (mountedRef.current) {
        setState('scanning');
        setMessage('Point the camera at the customer QR.');
      }
    } catch (error) {
      await stopScanner();

      if (!mountedRef.current) return;

      setState('error');

      setCameraError(
        error instanceof Error
          ? error.message
          : 'Unable to access the camera.',
      );

      setMessage('Camera could not be started.');
    }
  };

  const resetScanner = async () => {
    await startScanner();
  };

  useEffect(() => {
    mountedRef.current = true;

    void startScanner();

    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, []);

  const formatCheckInTime = (value?: string) => {
    if (!value) return '';

    try {
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const isResult = ['valid', 'used', 'invalid', 'error'].includes(
    state,
  );

  return (
    <div className="scanner-page">
      <div className="scanner-header">
        <div>
          <div className="kicker">MNG VENUE CONTROL</div>
          <h2>Ticket Scanner</h2>

          <p>
            Scan a customer QR to verify entry instantly.
          </p>
        </div>

        <div className="scanner-secure-pill">
          <ShieldCheck size={15} />
          Server verified
        </div>
      </div>

      <div className="scanner-layout">
        <section className="scanner-camera-panel">
          <div className="scanner-panel-top">
            <div>
              <span>LIVE SCANNER</span>
              <strong>
                {state === 'scanning'
                  ? 'Ready to scan'
                  : state === 'checking'
                    ? 'Checking ticket'
                    : state === 'starting'
                      ? 'Opening camera'
                      : 'Scanner paused'}
              </strong>
            </div>

            <div className="scanner-status-dot">
              <i
                className={
                  state === 'scanning' ? 'scanner-dot-live' : ''
                }
              />
            </div>
          </div>

          <div
            id="mng-ticket-reader"
            className="mng-ticket-reader"
          />

          <div className="scanner-camera-footer">
            <Camera size={16} />

            <span>
              Allow camera access when your browser asks.
            </span>
          </div>

          {cameraError && (
            <div className="scanner-error">
              <XCircle size={16} />
              <span>{cameraError}</span>
            </div>
          )}
        </section>

        <section className="scanner-result-panel">
          {!isResult && (
            <div className="scanner-waiting">
              <div className="scanner-waiting-icon">
                <ScanLine size={28} />
              </div>

              <div className="kicker">READY</div>

              <h3>Scan the ticket QR</h3>

              <p>
                The QR credential is checked against the MNG
                ticket database before entry is accepted.
              </p>

              <div className="scanner-trust-row">
                <span>
                  <ShieldCheck size={14} />
                  Secure credential
                </span>

                <span>
                  <Ticket size={14} />
                  One-time entry
                </span>
              </div>
            </div>
          )}

          {state === 'checking' && (
            <div className="scanner-checking">
              <div className="scanner-spin">
                <RefreshCw size={27} />
              </div>

              <div className="kicker">VERIFYING</div>

              <h3>Checking ticket…</h3>

              <p>
                Please wait while MNG confirms this ticket.
              </p>
            </div>
          )}

          {state === 'valid' && (
            <div className="scanner-result valid">
              <div className="result-icon">
                <CheckCircle2 size={42} />
              </div>

              <div className="kicker">MNG VERIFIED</div>

              <h3>ENTRY ACCEPTED</h3>

              <p className="result-main">
                This ticket has been successfully checked in.
              </p>

              <div className="result-details">
                <div>
                  <span>TICKET</span>
                  <strong>
                    {result?.ticket_number || '—'}
                  </strong>
                </div>

                <div>
                  <span>EVENT</span>
                  <strong>
                    {result?.event_name || '—'}
                  </strong>
                </div>

                <div>
                  <span>PASS</span>
                  <strong>
                    {result?.pass_name || '—'}
                  </strong>
                </div>

                <div>
                  <span>CHECKED IN</span>
                  <strong>
                    {formatCheckInTime(
                      result?.checked_in_at,
                    )}
                  </strong>
                </div>
              </div>

              <button
                className="primary full"
                onClick={() => void resetScanner()}
              >
                Scan next ticket
                <ScanLine size={17} />
              </button>
            </div>
          )}

          {state === 'used' && (
            <div className="scanner-result used">
              <div className="result-icon">
                <XCircle size={42} />
              </div>

              <div className="kicker">ENTRY BLOCKED</div>

              <h3>ALREADY USED</h3>

              <p className="result-main">
                This ticket has already been checked in.
              </p>

              <div className="result-details">
                <div>
                  <span>TICKET</span>
                  <strong>
                    {result?.ticket_number || '—'}
                  </strong>
                </div>

                <div>
                  <span>EVENT</span>
                  <strong>
                    {result?.event_name || '—'}
                  </strong>
                </div>

                <div>
                  <span>PASS</span>
                  <strong>
                    {result?.pass_name || '—'}
                  </strong>
                </div>

                <div>
                  <span>PREVIOUS ENTRY</span>
                  <strong>
                    {formatCheckInTime(
                      result?.checked_in_at,
                    )}
                  </strong>
                </div>
              </div>

              <button
                className="ghost full"
                onClick={() => void resetScanner()}
              >
                Scan another ticket
                <ScanLine size={17} />
              </button>
            </div>
          )}

          {state === 'invalid' && (
            <div className="scanner-result invalid">
              <div className="result-icon">
                <XCircle size={42} />
              </div>

              <div className="kicker">ENTRY BLOCKED</div>

              <h3>TICKET NOT VALID</h3>

              <p className="result-main">
                MNG could not validate this QR credential.
              </p>

              <div className="scanner-invalid-message">
                {result?.error ||
                  'Do not allow entry until the ticket is verified.'}
              </div>

              <button
                className="ghost full"
                onClick={() => void resetScanner()}
              >
                Scan again
                <ScanLine size={17} />
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="scanner-result invalid">
              <div className="result-icon">
                <XCircle size={42} />
              </div>

              <div className="kicker">SCANNER ERROR</div>

              <h3>TRY AGAIN</h3>

              <p className="result-main">
                {message ||
                  'Something went wrong while checking the ticket.'}
              </p>

              <button
                className="primary full"
                onClick={() => void resetScanner()}
              >
                Restart scanner
                <RefreshCw size={17} />
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="scanner-bottom-note">
        <ShieldCheck size={17} />

        <span>
          Never approve entry from the QR image alone. MNG checks
          the ticket credential on the server and records the
          first successful entry.
        </span>
      </div>
    </div>
  );
}
