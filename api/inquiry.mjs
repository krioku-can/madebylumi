import { handleInquiry } from '../lib/inquiry.mjs';

export async function POST(request) {
  return handleInquiry(request);
}
