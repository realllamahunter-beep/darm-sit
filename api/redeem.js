import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'https://localhost');
    const code = url.searchParams.get('code');
    const uid = url.searchParams.get('uid');
    const counter = url.searchParams.get('counter');

    if (!code || !uid || !counter) {
      return res.status(400).json({ valid: false, error: 'Missing parameters' });
    }

    // Look up the one‑time code
    const data = await redis.get(`code:${code}`);
    if (!data) {
      return res.status(200).json({ valid: false, reason: 'invalid_code' });
    }

    // Verify the stored UID and counter match the URL
    if (data.uid !== uid || data.counter !== parseInt(counter)) {
      return res.status(200).json({ valid: false, reason: 'tampered' });
    }

    if (data.used) {
      return res.status(200).json({ valid: false, reason: 'already_used' });
    }

    // Mark the code as used – this makes the link one‑time
    data.used = true;
    await redis.set(`code:${code}`, data, { ex: 600 }); // keep for 10 minutes

    return res.status(200).json({ valid: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ valid: false, error: e.message });
  }
}