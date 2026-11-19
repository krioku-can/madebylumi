import { handleForward } from '../lib/forward-inquiry.mjs';

export async function POST(request) {
  return handleForward(request);
}
