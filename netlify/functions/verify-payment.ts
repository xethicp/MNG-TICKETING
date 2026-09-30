import { createHmac, timingSafeEqual } from 'node:crypto';

type NetlifyEvent = { httpMethod?: string; body?: string | null };
type NetlifyResponse = { statusCode: number; headers: Record<string,string>; body: string };

const json = (statusCode:number, body:unknown):NetlifyResponse => ({
  statusCode,
  headers: {
    'Content-Type':'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.PUBLIC_SITE_ORIGIN || '*',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

const env=(name:string)=>{
  const v=process.env[name];
  if(!v) throw new Error(`Missing server environment variable: ${name}`);
  return v;
};

const rpc = async (supabaseUrl:string, serviceRoleKey:string, orderId:string, paymentId:string) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/mng_finalize_paid_order`, {
    method:'POST',
    headers:{
      apikey:serviceRoleKey,
      Authorization:`Bearer ${serviceRoleKey}`,
      'Content-Type':'application/json',
      Accept:'application/json',
    },
    body:JSON.stringify({p_order_id:orderId,p_payment_id:paymentId}),
  });
  const text=await response.text();
  if(!response.ok) throw new Error('PAYMENT_FINALIZATION_FAILED');
  let data:unknown;
  try { data=JSON.parse(text); } catch { data=null; }
  const count=Array.isArray(data) ? data[0] : data;
  return Number(count || 0);
};

export const handler = async (event:NetlifyEvent):Promise<NetlifyResponse> => {
  if(event.httpMethod==='OPTIONS') return json(204,null);
  if(event.httpMethod!=='POST') return json(405,{error:'Method Not Allowed'});

  try {
    const supabaseUrl=env('SUPABASE_URL').replace(/\/$/,'');
    const serviceRoleKey=env('SUPABASE_SERVICE_ROLE_KEY');
    const razorpaySecret=env('RAZORPAY_KEY_SECRET');
    const body=JSON.parse(event.body||'{}') as {
      order_id?:unknown;
      razorpay_order_id?:unknown;
      razorpay_payment_id?:unknown;
      razorpay_signature?:unknown;
    };

    const orderId=typeof body.order_id==='string'?body.order_id:'';
    const razorpayOrderId=typeof body.razorpay_order_id==='string'?body.razorpay_order_id:'';
    const paymentId=typeof body.razorpay_payment_id==='string'?body.razorpay_payment_id:'';
    const signature=typeof body.razorpay_signature==='string'?body.razorpay_signature:'';
    if(!orderId||!razorpayOrderId||!paymentId||!signature) {
      return json(400,{error:'Incomplete payment verification request.'});
    }

    const expected=createHmac('sha256',razorpaySecret).update(`${razorpayOrderId}|${paymentId}`).digest('hex');
    const expectedBuf=Buffer.from(expected,'utf8');
    const receivedBuf=Buffer.from(signature,'utf8');
    if(expectedBuf.length!==receivedBuf.length || !timingSafeEqual(expectedBuf,receivedBuf)) {
      return json(400,{error:'Payment signature verification failed.'});
    }

    const ticketCount=await rpc(supabaseUrl,serviceRoleKey,orderId,paymentId);

    return json(200,{verified:true,order_id:orderId,razorpay_payment_id:paymentId,ticket_count:ticketCount});
  } catch(e) {
    const msg=e instanceof Error?e.message:'Unable to verify payment.';
    const safe=msg==='ORDER_NOT_FOUND'?'Order not found.':
      msg==='ORDER_NOT_PAYABLE'?'This order is no longer payable.':
      msg==='RESERVATION_MISSING'?'Ticket reservation could not be finalized.':
      msg==='PAYMENT_FINALIZATION_FAILED'?'Payment was verified, but ticket issuance is still pending.':'Unable to verify payment right now.';
    return json(400,{error:safe});
  }
};
