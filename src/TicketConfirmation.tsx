import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  MapPin,
  Share2,
  ShieldCheck,
  Sparkles,
  Ticket as TicketIcon,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';

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

type DiscoverEvent = EventData & {
  slug: string;
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

const shareCaption = (
  event: EventData | null,
  pass: PassData | null,
) =>
  `I'm going to ${event?.name || 'my next MNG experience'} ✦\n` +
  `${dateLabel(event?.event_date || null)} · ${event?.location || event?.venue || 'Location TBA'}\n` +
  `${pass?.name || 'MNG Pass'} · Booked on Mars Nova Global`;

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines;
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const downloadShareCard = (
  event: EventData | null,
  pass: PassData | null,
) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;

  const ctx = canvas.getContext('2d');

  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, 1080, 1920);
  bg.addColorStop(0, '#020817');
  bg.addColorStop(0.45, '#071c3e');
  bg.addColorStop(1, '#031126');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(
    820,
    180,
    20,
    820,
    180,
    600,
  );

  glow.addColorStop(0, 'rgba(70,156,255,.35)');
  glow.addColorStop(1, 'rgba(70,156,255,0)');

  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow2 = ctx.createRadialGradient(
    150,
    1600,
    20,
    150,
    1600,
    520,
  );

  glow2.addColorStop(0, 'rgba(55,105,255,.20)');
  glow2.addColorStop(1, 'rgba(55,105,255,0)');

  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 70; i += 1) {
    const x = (i * 173) % 1080;
    const y = (i * 281) % 1920;
    const radius = i % 4 === 0 ? 3 : 1.4;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle =
      i % 5 === 0
        ? 'rgba(255,255,255,.65)'
        : 'rgba(136,190,255,.35)';
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Arial';
  ctx.letterSpacing = '4px';
  ctx.fillText('✦ MARS NOVA', 70, 100);

  ctx.fillStyle = '#73baff';
  ctx.font = '700 23px Arial';
  ctx.fillText('OFFICIAL MNG EXPERIENCE', 72, 155);

  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.font = '600 22px Arial';
  ctx.fillText('I’M GOING', 72, 430);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 98px Arial';

  const nameLines = wrapText(
    ctx,
    (event?.name || 'MNG EXPERIENCE').toUpperCase(),
    900,
  );

  let y = 550;

  for (const line of nameLines.slice(0, 3)) {
    ctx.fillText(line, 72, y);
    y += 110;
  }

  ctx.fillStyle = '#a9d5ff';
  ctx.font = '600 34px Arial';

  ctx.fillText(
    `${dateLabel(event?.event_date || null)}  ·  ${
      event?.location || event?.venue || 'LOCATION TBA'
    }`,
    75,
    y + 35,
  );

  roundedRect(ctx, 70, 980, 940, 380, 34);

  const cardGradient = ctx.createLinearGradient(70, 980, 1010, 1360);
  cardGradient.addColorStop(0, 'rgba(16,49,96,.92)');
  cardGradient.addColorStop(1, 'rgba(5,18,37,.96)');

  ctx.fillStyle = cardGradient;
  ctx.fill();

  ctx.strokeStyle = 'rgba(130,190,255,.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#6eb8ff';
  ctx.font = '700 20px Arial';
  ctx.fillText('YOUR MNG PASS', 110, 1055);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 54px Arial';
  ctx.fillText(pass?.name || 'MNG PASS', 110, 1130);

  ctx.fillStyle = '#8ea8c5';
  ctx.font = '500 25px Arial';
  ctx.fillText(
    `${dateLabel(event?.event_date || null)}  ·  ${timeLabel(
      event?.start_time || null,
    )}`,
    110,
    1190,
  );

  ctx.fillStyle = '#8ea8c5';
  ctx.font = '500 25px Arial';
  ctx.fillText(
    event?.venue || event?.location || 'MNG VERIFIED EXPERIENCE',
    110,
    1240,
  );

  ctx.fillStyle = '#69e8b5';
  ctx.font = '700 23px Arial';
  ctx.fillText('✓ BOOKED ON MNG', 110, 1300);

  ctx.fillStyle = 'rgba(255,255,255,.62)';
  ctx.font = '500 22px Arial';
  ctx.fillText(
    'Secure ticketing · Real experiences · Mars Nova Global',
    72,
    1715,
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 27px Arial';
  ctx.fillText('marsnovaglobal.netlify.app', 72, 1770);

  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.font = '500 19px Arial';
  ctx.fillText(
    'Share the moment. Keep the ticket private.',
    72,
    1830,
  );

  const link = document.createElement('a');

  link.download = 'MNG-booking-moment.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
};

export default function TicketConfirmation({
  orderId,
  paymentId,
  navigate,
}: Props) {
  const [data, setData] = useState<OrderResponse | null>(null);
  const [discoverEvents, setDiscoverEvents] = useState<DiscoverEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareNotice, setShareNotice] = useState('');

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
          throw new Error(
            result?.error || 'Unable to load your ticket.',
          );
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

  useEffect(() => {
    if (!data?.event?.id || !supabase) return;

    const client = supabase;
    let alive = true;

    const loadDiscover = async () => {
      const { data: events } = await client
        .from('events')
        .select(
          'id,slug,name,subtitle,venue,location,event_date,start_time,hero_image_url',
        )
        .eq('status', 'published')
        .eq('show_on_home', true)
        .neq('id', data.event?.id)
        .order('featured', { ascending: false })
        .order('event_date', { ascending: true })
        .limit(3);

      if (alive) {
        setDiscoverEvents((events || []) as DiscoverEvent[]);
      }
    };

    void loadDiscover();

    return () => {
      alive = false;
    };
  }, [data?.event?.id]);

  const shareMoment = async () => {
    if (!data) return;

    const text = shareCaption(data.event, data.pass);

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My MNG Experience',
          text,
          url: window.location.origin,
        });

        setShareNotice('Shared. Your ticket QR stays private.');
      } else {
        await navigator.clipboard.writeText(
          `${text}\n\n${window.location.origin}`,
        );

        setShareNotice(
          'Caption copied. Post your MNG moment anywhere.',
        );
      }
    } catch {
      setShareNotice('');
    }
  };

  const downloadDetails = (ticket: TicketData) => {
    const content = [
      'MARS NOVA GLOBAL',
      'DIGITAL EVENT TICKET',
      '',
      `Event: ${data?.event?.name || 'MNG Event'}`,
      `Pass: ${data?.pass?.name || 'MNG Pass'}`,
      `Ticket: ${ticket.ticket_number}`,
      `Status: ${ticket.status}`,
      '',
      'Present the QR at venue entry.',
      'Ticket validation is performed server-side.',
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

  if (loading) {
    return (
      <div className="portal">
        <main className="portal-main">
          <div className="empty">
            <TicketIcon size={32} />
            <h2>Preparing your MNG moment…</h2>
            <p>
              Your payment is confirmed. We’re securely preparing your
              digital experience.
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
            <h2>We couldn't open your ticket</h2>
            <p>
              {error || 'Your ticket details are unavailable right now.'}
            </p>

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

          {/* HERO */}
          <section className="mng-confirmation-hero">
            <div className="confirmation-orbit">
              <Sparkles size={24} />
            </div>

            <div className="kicker">MNG EXPERIENCE UNLOCKED</div>

            <h1>
              You're officially
              <br />
              <span>on the list.</span>
            </h1>

            <p>
              Your booking is confirmed. Your next unforgettable night
              starts here.
            </p>

            <div className="confirmation-badges">
              <span>
                <CheckCircle2 size={14} />
                Payment confirmed
              </span>

              <span>
                <ShieldCheck size={14} />
                MNG verified
              </span>

              <span>
                <TicketIcon size={14} />
                {data.order.quantity} ticket
                {data.order.quantity > 1 ? 's' : ''}
              </span>
            </div>

            <div className="hero-order-pill">
              <span>BOOKING</span>
              <strong>{data.order.order_number}</strong>
            </div>
          </section>

          {/* SHARE MOMENT */}
          <section className="mng-share-section">
            <div className="share-copy">
              <div className="kicker">MAKE IT OFFICIAL</div>

              <h2>Your night deserves a post.</h2>

              <p>
                Share your MNG booking with your people. The social card
                contains your experience details — never your private
                entry QR.
              </p>

              <div className="share-actions">
                <button
                  className="primary"
                  onClick={() => void shareMoment()}
                >
                  <Share2 size={17} />
                  Share my MNG moment
                </button>

                <button
                  className="ghost"
                  onClick={() =>
                    downloadShareCard(event, pass)
                  }
                >
                  <Download size={17} />
                  Save story card
                </button>
              </div>

              {shareNotice && (
                <div className="form-success">
                  <Check size={14} />
                  {shareNotice}
                </div>
              )}
            </div>

            <div className="social-story-card">
              <div className="story-stars">
                <span>✦</span>
                <span>·</span>
                <span>✦</span>
              </div>

              <div className="story-brand">MARS NOVA</div>

              <small>I’M GOING</small>

              <h3>
                {(event?.name || 'MNG EXPERIENCE').toUpperCase()}
              </h3>

              <div className="story-line" />

              <strong>{pass?.name || 'MNG PASS'}</strong>

              <span>
                {dateLabel(event?.event_date || null)}
                {' · '}
                {event?.location || event?.venue || 'SURAT'}
              </span>

              <div className="story-bottom">
                <b>✓ BOOKED ON MNG</b>
                <small>mars nova global</small>
              </div>
            </div>
          </section>

          {/* EVENT */}
          <section className="ticket-event-card premium-event-card">
            {event?.hero_image_url ? (
              <div
                className="ticket-event-image"
                style={{
                  background: `url(${event.hero_image_url}) center/cover`,
                }}
              />
            ) : (
              <div className="ticket-event-image event-image-placeholder">
                <Sparkles size={32} />
                <span>MNG VERIFIED</span>
              </div>
            )}

            <div className="ticket-event-content">
              <div className="kicker">YOUR EXPERIENCE</div>

              <h2>{event?.name || 'MNG Experience'}</h2>

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
                  {event?.venue ||
                    event?.location ||
                    'Location TBA'}
                </span>
              </div>
            </div>
          </section>

          {/* BOOKING SUMMARY */}
          <section className="ticket-summary-card premium-summary-card">
            <div className="summary-intro">
              <div>
                <div className="kicker">BOOKING DETAILS</div>
                <h2>Everything's sorted.</h2>
              </div>

              <Users size={21} />
            </div>

            <div className="summary-grid">
              <div className="summary-box">
                <span>PASS</span>
                <strong>{pass?.name || 'MNG Pass'}</strong>
              </div>

              <div className="summary-box">
                <span>QUANTITY</span>
                <strong>{data.order.quantity}</strong>
              </div>

              <div className="summary-box">
                <span>TOTAL PAID</span>
                <strong>
                  {money(Number(data.order.amount_paise) / 100)}
                </strong>
              </div>

              <div className="summary-box">
                <span>PAYMENT</span>
                <strong className="payment-confirmed">
                  CAPTURED
                </strong>
              </div>
            </div>
          </section>

          {/* DIGITAL TICKETS */}
          <section className="digital-tickets-section premium-tickets-section">
            <div className="section-head">
              <div>
                <div className="kicker">PRIVATE ENTRY CREDENTIAL</div>
                <h2>Your tickets are ready.</h2>
              </div>

              <div className="radar-live">
                <span className="live-dot" />
                Protected
              </div>
            </div>

            <div className="ticket-private-warning">
              <ShieldCheck size={17} />

              <span>
                Keep your QR private. MNG validates this credential
                against the server at venue entry.
              </span>
            </div>

            <div className="digital-ticket-grid">
              {data.tickets.map((ticket, index) => (
                <article
                  className="digital-ticket-card premium-ticket-card"
                  key={ticket.id}
                >
                  <div className="digital-ticket-header">
                    <div>
                      <span>
                        TICKET {String(index + 1).padStart(2, '0')}
                      </span>

                      <strong>{ticket.ticket_number}</strong>
                    </div>

                    <ShieldCheck size={20} />
                  </div>

                  <div className="qr-wrap premium-qr-wrap">
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
                        downloadDetails(ticket)
                      }
                    >
                      <Download size={14} />
                      Save details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* MEMORY / LOYALTY */}
          <section className="mng-loyalty-card">
            <div className="loyalty-icon">
              ✦
            </div>

            <div>
              <div className="kicker">WELCOME TO THE MNG CROWD</div>

              <h2>
                This was one night.
                <br />
                There are more waiting.
              </h2>

              <p>
                Keep MNG in your plans. New experiences, concerts and
                nights worth remembering are always being added.
              </p>

              <button
                className="primary"
                onClick={() => navigate('/')}
              >
                Discover more MNG experiences
                <ArrowRight size={17} />
              </button>
            </div>
          </section>

          {/* DISCOVER */}
          {discoverEvents.length > 0 && (
            <section className="mng-discover-section">
              <div className="section-head">
                <div>
                  <div className="kicker">WHAT'S NEXT</div>
                  <h2>Keep the MNG streak going.</h2>
                </div>

                <Sparkles size={21} />
              </div>

              <div className="mng-discover-grid">
                {discoverEvents.map((item) => (
                  <article
                    className="mng-discover-card"
                    key={item.id}
                    onClick={() =>
                      navigate(`/events/${item.slug}`)
                    }
                  >
                    <div
                      className="mng-discover-image"
                      style={{
                        background: item.hero_image_url
                          ? `url(${item.hero_image_url}) center/cover`
                          : 'linear-gradient(135deg,#071a3d,#174aa6 50%,#62a7ff)',
                      }}
                    >
                      <span>MNG EVENT</span>
                    </div>

                    <div className="mng-discover-body">
                      <div>
                        <h3>{item.name}</h3>

                        <p>
                          {dateLabel(item.event_date)}
                          {' · '}
                          {item.location ||
                            item.venue ||
                            'Location TBA'}
                        </p>
                      </div>

                      <ExternalLink size={17} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="ticket-final-footer">
            <span>✦ MARS NOVA GLOBAL</span>
            <small>Events · Experiences · Memories</small>
          </div>
        </div>
      </main>
    </div>
  );
}
