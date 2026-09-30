import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Ticket,
  UserRound,
  XCircle,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';

type ScannerMode = 'scan' | 'manual';

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
  ambiguous?: boolean;
  manual_entry?: boolean;
  ticket_id?: string;
  ticket_number?: string;
  order_number?: string;
  event_name?: string;
  pass_name?: string;
  checked_in_at?: string;
  match_count?: number;
  error?: string;
};

export default function TicketScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);

  const [mode, setMode] = useState<ScannerMode>('scan');
  const [state, setState] = useState<ScanState>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      if (scanner.getState() === 2) {
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

  const checkQrTicket = async (qrToken: string) => {
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
        throw new Error(
          'Your staff session has expired. Please sign in again.',
        );
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

    if (!mountedRef.current) return;

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
          await checkQrTicket(decodedText);
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

  const changeMode = async (nextMode: ScannerMode) => {
    await stopScanner();

    setMode(nextMode);
    setState('idle');
    setResult(null);
    setMessage('');
    setCameraError('');
    setIdentifier('');
    processingRef.current = false;
  };

  const manualCheckIn = async () => {
    const value = identifier.trim();

    if (value.length < 3) {
      setState('invalid');
      setResult({
        valid: false,
        error:
          'Enter a ticket number, order number, customer phone or email.',
      });
      return;
    }

    if (manualSubmitting) return;

    setManualSubmitting(true);
    setState('checking');
    setMessage('Verifying manual entry…');
    setResult(null);

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured.');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          'Your staff session has expired. Please sign in again.',
        );
      }

      const response = await fetch(
        '/.netlify/functions/manual-check-in',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            identifier: value,
          }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as ScanResult;
      setResult(data);

      if (response.ok && data.valid) {
        setState('valid');
        setMessage('ENTRY ACCEPTED');
        setIdentifier('');
      } else if (response.status === 409 && data.already_used) {
        setState('used');
        setMessage('ALREADY USED');
      } else {
        setState('invalid');
        setMessage(
          data.error || 'Ticket could not be verified.',
        );
      }
    } catch (error) {
      setState('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to verify ticket.',
      );
    } finally {
      setManualSubmitting(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, []);

  useEffect(() => {
    if (mode === 'scan') {
      void startScanner();
    } else {
      void stopScanner();
      setState('idle');
      setResult(null);
      setMessage('');
      setCameraError('');
    }

    return () => {
      if (mode === 'scan') {
        void stopScanner();
      }
    };
  }, [mode]);

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

  const resetManual = () => {
    setState('idle');
    setResult(null);
    setMessage('');
    setIdentifier('');
  };

  const isResult = ['valid', 'used', 'invalid', 'error'].includes(state);

  return (
    <div className="scanner-page">
      <div className="scanner-header">
        <div>
          <div className="kicker">MNG VENUE CONTROL</div>
          <h2>Entry Control</h2>
          <p>
            Verify customer tickets with QR scan or secure manual entry.
          </p>
        </div>

        <div className="scanner-secure-pill">
          <ShieldCheck size={15} />
          Server verified
        </div>
      </div>

      <div className="scanner-mode-switch">
        <button
          className={mode === 'scan' ? 'active' : ''}
          onClick={() => void changeMode('scan')}
          type="button"
        >
          <ScanLine size={17} />
          QR Scan
        </button>

        <button
          className={mode === 'manual' ? 'active' : ''}
          onClick={() => void changeMode('manual')}
          type="button"
        >
          <Search size={17} />
          Manual Entry
        </button>
      </div>

      {mode === 'scan' ? (
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
                    state === 'scanning'
                      ? 'scanner-dot-live'
                      : ''
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
            {!isResult && state !== 'checking' && (
              <ReadyCard
                icon={<ScanLine size={28} />}
                kicker="READY"
                title="Scan the ticket QR"
                text="The QR credential is checked against the MNG ticket database before entry is accepted."
              />
            )}

            {state === 'checking' && (
              <CheckingCard text="Please wait while MNG confirms this ticket." />
            )}

            {state === 'valid' && (
              <div className="scanner-result valid">
                <ResultIcon type="valid" />

                <div className="kicker">MNG VERIFIED</div>
                <h3>ENTRY ACCEPTED</h3>
                <p className="result-main">
                  This ticket has been successfully checked in.
                </p>

                <ResultDetails
                  result={result}
                  formatCheckInTime={formatCheckInTime}
                />

                <button
                  className="primary full"
                  onClick={() => void startScanner()}
                  type="button"
                >
                  Scan next ticket
                  <ScanLine size={17} />
                </button>
              </div>
            )}

            {state === 'used' && (
              <div className="scanner-result used">
                <ResultIcon type="used" />

                <div className="kicker">ENTRY BLOCKED</div>
                <h3>ALREADY USED</h3>
                <p className="result-main">
                  This ticket has already been checked in.
                </p>

                <ResultDetails
                  result={result}
                  formatCheckInTime={formatCheckInTime}
                  used
                />

                <button
                  className="ghost full"
                  onClick={() => void startScanner()}
                  type="button"
                >
                  Scan another ticket
                  <ScanLine size={17} />
                </button>
              </div>
            )}

            {state === 'invalid' && (
              <div className="scanner-result invalid">
                <ResultIcon type="invalid" />

                <div className="kicker">ENTRY BLOCKED</div>
                <h3>
                  {result?.ambiguous
                    ? 'MULTIPLE MATCHES'
                    : 'TICKET NOT VALID'}
                </h3>

                <p className="result-main">
                  {result?.error ||
                    'MNG could not validate this QR credential.'}
                </p>

                <button
                  className="ghost full"
                  onClick={() => void startScanner()}
                  type="button"
                >
                  Scan again
                  <ScanLine size={17} />
                </button>
              </div>
            )}

            {state === 'error' && (
              <div className="scanner-result invalid">
                <ResultIcon type="invalid" />

                <div className="kicker">SCANNER ERROR</div>
                <h3>TRY AGAIN</h3>

                <p className="result-main">
                  {message ||
                    'Something went wrong while checking the ticket.'}
                </p>

                <button
                  className="primary full"
                  onClick={() => void startScanner()}
                  type="button"
                >
                  Restart scanner
                  <RefreshCw size={17} />
                </button>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="scanner-layout">
          <section className="scanner-camera-panel manual-entry-panel">
            <div className="scanner-panel-top">
              <div>
                <span>MANUAL ENTRY</span>
                <strong>Search a customer ticket</strong>
              </div>

              <div className="scanner-status-dot manual-dot">
                <i className="scanner-dot-live" />
              </div>
            </div>

            <div className="manual-entry-body">
              <div className="manual-entry-icon">
                <UserRound size={30} />
              </div>

              <div className="kicker">NO CAMERA REQUIRED</div>

              <h3>Find the customer</h3>

              <p>
                Enter a ticket number, MNG order number, customer phone
                or customer email. MNG verifies the match on the server
                before allowing entry.
              </p>

              <label className="manual-entry-label">
                Ticket / order / phone / email
                <div className="manual-input-wrap">
                  <Search size={18} />

                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);

                      if (state !== 'idle') {
                        setState('idle');
                        setResult(null);
                        setMessage('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void manualCheckIn();
                      }
                    }}
                    placeholder="MNG-TKT-0001 or +91… or email"
                    autoComplete="off"
                    disabled={manualSubmitting}
                  />
                </div>
              </label>

              <button
                className="primary full manual-submit"
                onClick={() => void manualCheckIn()}
                disabled={
                  manualSubmitting ||
                  identifier.trim().length < 3
                }
                type="button"
              >
                {manualSubmitting
                  ? 'Verifying customer…'
                  : 'Verify & check in'}
                <CheckCircle2 size={18} />
              </button>

              <div className="manual-entry-hints">
                <span>
                  <Ticket size={14} />
                  Exact ticket ID works best
                </span>

                <span>
                  <ShieldCheck size={14} />
                  Ambiguous matches are blocked
                </span>
              </div>
            </div>
          </section>

          <section className="scanner-result-panel">
            {!isResult && state !== 'checking' && (
              <ReadyCard
                icon={<Search size={28} />}
                kicker="MANUAL MODE"
                title="Ready for entry lookup"
                text="No scanner or app is needed. Enter the customer's details and MNG will perform the same server-side ticket verification used by QR entry."
              />
            )}

            {state === 'checking' && (
              <CheckingCard text="MNG is checking the ticket and recording entry." />
            )}

            {state === 'valid' && (
              <div className="scanner-result valid">
                <ResultIcon type="valid" />

                <div className="kicker">MNG VERIFIED</div>
                <h3>ENTRY ACCEPTED</h3>

                <p className="result-main">
                  Manual entry was verified and recorded successfully.
                </p>

                <ResultDetails
                  result={result}
                  formatCheckInTime={formatCheckInTime}
                />

                <button
                  className="primary full"
                  onClick={resetManual}
                  type="button"
                >
                  Check in next customer
                  <UserRound size={17} />
                </button>
              </div>
            )}

            {state === 'used' && (
              <div className="scanner-result used">
                <ResultIcon type="used" />

                <div className="kicker">ENTRY BLOCKED</div>
                <h3>ALREADY USED</h3>

                <p className="result-main">
                  This ticket has already been checked in.
                </p>

                <ResultDetails
                  result={result}
                  formatCheckInTime={formatCheckInTime}
                  used
                />

                <button
                  className="ghost full"
                  onClick={resetManual}
                  type="button"
                >
                  Check another customer
                  <UserRound size={17} />
                </button>
              </div>
            )}

            {state === 'invalid' && (
              <div className="scanner-result invalid">
                <ResultIcon type="invalid" />

                <div className="kicker">ENTRY BLOCKED</div>
                <h3>
                  {result?.ambiguous
                    ? 'MULTIPLE MATCHES'
                    : 'TICKET NOT VALID'}
                </h3>

                <p className="result-main">
                  {result?.error ||
                    'MNG could not validate this customer information.'}
                </p>

                <button
                  className="ghost full"
                  onClick={resetManual}
                  type="button"
                >
                  Try another entry
                  <Search size={17} />
                </button>
              </div>
            )}

            {state === 'error' && (
              <div className="scanner-result invalid">
                <ResultIcon type="invalid" />

                <div className="kicker">ENTRY ERROR</div>
                <h3>TRY AGAIN</h3>

                <p className="result-main">
                  {message ||
                    'Something went wrong while checking the customer.'}
                </p>

                <button
                  className="primary full"
                  onClick={resetManual}
                  type="button"
                >
                  Try again
                  <RefreshCw size={17} />
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      <div className="scanner-bottom-note">
        <ShieldCheck size={17} />

        <span>
          QR and manual entry use the same server-side ticket validation.
          A successful entry is recorded once, and later attempts are
          blocked as already used.
        </span>
      </div>
    </div>
  );
}

function ReadyCard({
  icon,
  kicker,
  title,
  text,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  text: string;
}) {
  return (
    <div className="scanner-waiting">
      <div className="scanner-waiting-icon">{icon}</div>

      <div className="kicker">{kicker}</div>
      <h3>{title}</h3>
      <p>{text}</p>

      <div className="scanner-trust-row">
        <span>
          <ShieldCheck size={14} />
          Server verified
        </span>

        <span>
          <Ticket size={14} />
          One-time entry
        </span>
      </div>
    </div>
  );
}

function CheckingCard({ text }: { text: string }) {
  return (
    <div className="scanner-checking">
      <div className="scanner-spin">
        <RefreshCw size={27} />
      </div>

      <div className="kicker">VERIFYING</div>
      <h3>Checking customer…</h3>
      <p>{text}</p>
    </div>
  );
}

function ResultIcon({ type }: { type: 'valid' | 'used' | 'invalid' }) {
  if (type === 'valid') {
    return (
      <div className="result-icon">
        <CheckCircle2 size={42} />
      </div>
    );
  }

  return (
    <div className="result-icon">
      <XCircle size={42} />
    </div>
  );
}

function ResultDetails({
  result,
  formatCheckInTime,
  used = false,
}: {
  result: ScanResult | null;
  formatCheckInTime: (value?: string) => string;
  used?: boolean;
}) {
  return (
    <div className="result-details">
      <div>
        <span>TICKET</span>
        <strong>{result?.ticket_number || '—'}</strong>
      </div>

      <div>
        <span>ORDER</span>
        <strong>{result?.order_number || '—'}</strong>
      </div>

      <div>
        <span>EVENT</span>
        <strong>{result?.event_name || '—'}</strong>
      </div>

      <div>
        <span>PASS</span>
        <strong>{result?.pass_name || '—'}</strong>
      </div>

      <div>
        <span>{used ? 'ENTRY STATUS' : 'CHECKED IN'}</span>
        <strong>
          {used
            ? formatCheckInTime(result?.checked_in_at) ||
              'Previously recorded'
            : formatCheckInTime(result?.checked_in_at) || 'Just now'}
        </strong>
      </div>
    </div>
  );
}
