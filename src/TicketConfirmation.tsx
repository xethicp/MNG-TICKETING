import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Download, MapPin, ShieldCheck, Ticket as TicketIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type TicketData = {
  id: string;
  ticket_number: string;
  qr_token: string;
  status: string;
  created_at: string;
};

type OrderData = {
  id: string;
  order_number: string;
  quantity: number;
  amount_paise: number;
  payment_status: string;
  status: string;
  razorpay_payment_id: string | null;
  created_at: string;
};

type EventData = {
  id: string;
  name: string;
  subtitle: string | null;
  venue: string | null;
  location: string | null;
  event_date: string | null;
  start_time: string | null;
  hero_image_url: string | null;
};

type PassData = {
  id: string;
  name: string;
  description: string | null;
};

type OrderResponse = {
  order: OrderData;
  event: EventData | null;
  pass: PassData | null;
  tickets: TicketData[];
};

type Props = {
  orderId: string;
  paymentId: string;
  navigate: (to: string) => void;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const dateLabel = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(`${date}T00:00:00`))
    : 'DATE TBA';

const timeLabel = (time: string | null) => {
  if (!time) return 'TIME TBA';

  const [h = 0, m = 0] = time.split(':').map(Number);

  const d = new Date();
  d.setHours(h, m, 0, 0);

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
};

const downloadTicket = (ticket: TicketData, eventName: string, passName: string) => {
  const content = [
    'MARS NOVA GLOBAL',
    'DIGITAL EVENT TICKET',
    '',
    `Event: ${eventName}`,
    `Pass: ${passName}`,
    `Ticket: ${ticket.ticket_number}`,
    `Status: ${ticket.status}`,
    '',
    'Present this ticket QR at the venue.',
    'This ticket is validated server-side and can only be used once.',
  ].join('\n');

  const blob = new Blob([content], {
    type: 'text/plain;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `${ticket.ticket_number}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
};

export default function TicketConfirmation({
  orderId,
  paymentId,
  navigate,
}: Props) {
  const [data, setData] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const response = await fetch('/.netlify/functions/get-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: orderId,
            razorpay_payment_id: paymentId,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result?.error || 'Unable to load your ticket.');
        }

        if (alive) {
          setData(result as OrderResponse);
          setLoading(false);
        }
      } catch (err) {
        if (alive) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your ticket.',
          );
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [orderId, paymentId]);

  if (loading) {
    return (
      <div className="portal">
        <main className="portal-main">
          <div className="empty">
            <TicketIcon size={32} />
            <h2>Generating your MNG ticket…</h2>
            <p>
              We are securely loading your confirmed booking and unique QR
              ticket.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="portal">
        <main className="portal-main">
          <div className="empty">
            <h2>Ticket could not be loaded</h2>
            <p>{error || 'Your ticket details are unavailable.'}</p>
            <button
              className="primary"
              onClick={() => navigate('/')}
            >
              Back to MNG
              <ArrowLeft size={17} />
            </button>
          </div>
        </main>
      </div>
    );
  }

  const event = data.event;
  const pass = data.pass;

  return (
    <div className="portal">
      <main className="portal-main">
        <div className="ticket-confirmation-shell">
          <button
            className="back"
            onClick={() => navigate('/')}
          >
            <ArrowLeft size={16} />
            Back to MNG
          </button>

          <section className="ticket-success-card">
            <div className="ticket-success-icon">
              <CheckCircle2 size={34} />
            </div>

            <div className="kicker">BOOKING CONFIRMED</div>

            <h1>Your experience is booked.</h1>

            <p>
              Your payment has been confirmed and your unique MNG digital
              ticket has been generated.
            </p>

            <div className="ticket-order-number">
              <span>ORDER</span>
              <strong>{data.order.order_number}</strong>
            </div>
          </section>

          <section className="ticket-event-card">
            {event?.hero_image_url && (
              <div
                className="ticket-event-image"
                style={{
                  background: `url(${event.hero_image_url}) center/cover`,
                }}
              />
            )}

            <div className="ticket-event-content">
              <div className="kicker">MNG VERIFIED EVENT</div>

              <h2>{event?.name || 'MNG Event'}</h2>

              {event?.subtitle && (
                <p className="subtitle">{event.subtitle}</p>
              )}

              <div className="ticket-event-meta">
                <span>
                  <CalendarDays size={15} />
                  {dateLabel(event?.event_date || null)}
                  {' · '}
                  {timeLabel(event?.start_time || null)}
                </span>

                <span>
                  <MapPin size={15} />
                  {event?.venue || event?.location || 'Location TBA'}
                </span>
              </div>
            </div>
          </section>

          <section className="ticket-summary-card">
            <div className="ticket-summary-row">
              <span>Pass</span>
              <strong>{pass?.name || 'MNG Pass'}</strong>
            </div>

            <div className="ticket-summary-row">
              <span>Quantity</span>
              <strong>{data.order.quantity}</strong>
            </div>

            <div className="ticket-summary-row">
              <span>Total paid</span>
              <strong>{money(Number(data.order.amount_paise) / 100)}</strong>
            </div>

            <div className="ticket-summary-row">
              <span>Payment</span>
              <strong className="payment-confirmed">
                Captured
              </strong>
            </div>
          </section>

          <section className="digital-tickets-section">
            <div className="section-head">
              <div>
                <div className="kicker">YOUR DIGITAL TICKETS</div>
                <h2>Ready for entry.</h2>
              </div>

              <div className="radar-live">
                <span className="live-dot" />
                Valid
              </div>
            </div>

            <div className="digital-ticket-grid">
              {data.tickets.map((ticket, index) => (
                <article
                  className="digital-ticket-card"
                  key={ticket.id}
                >
                  <div className="digital-ticket-header">
                    <div>
                      <span>Ticket {index + 1}</span>
                      <strong>{ticket.ticket_number}</strong>
                    </div>

                    <ShieldCheck size={20} />
                  </div>

                  <div className="qr-wrap">
                    <QRCodeSVG
                      value={ticket.qr_token}
                      size={220}
                      level="H"
                      includeMargin
                    />
                  </div>

                  <div className="qr-security">
                    <ShieldCheck size={15} />

                    <span>
                      Unique secure QR
                      <br />
                      Server-validated at entry
                    </span>
                  </div>

                  <div className="digital-ticket-footer">
                    <span className="ticket-status">
                      {ticket.status.toUpperCase()}
                    </span>

                    <button
                      className="ghost small"
                      onClick={() =>
                        downloadTicket(
                          ticket,
                          event?.name || 'MNG Event',
                          pass?.name || 'MNG Pass',
                        )
                      }
                    >
                      <Download size={15} />
                      Save details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="ticket-security-note">
            <ShieldCheck size={20} />

            <div>
              <strong>Protect your ticket</strong>
              <p>
                Each QR is generated from a unique random credential created
                when your payment is successfully finalized. The QR cannot be
                edited to change the ticket details. At the venue, MNG will
                validate the credential against the server before accepting
                the ticket.
              </p>
            </div>
          </section>

          <div className="ticket-actions">
            <button
              className="primary"
              onClick={() => navigate('/')}
            >
              Explore more events
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
