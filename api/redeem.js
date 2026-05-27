import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'https://localhost');
    const code = url.searchParams.get('code');
    const uid = url.searchParams.get('uid');
    const counter = url.searchParams.get('counter');

    if (!code || !uid || !counter) {
      return res.status(400).json({ valid: false, error: 'Missing parameters' });
    }

    // Look up the code in KV
    const data = await kv.get(`code:${code}`);
    if (!data) {
      return res.status(200).json({ valid: false, reason: 'invalid_code' });
    }

    // Verify that the stored UID and counter match the URL parameters
    if (data.uid !== uid || data.counter !== parseInt(counter)) {
      return res.status(200).json({ valid: false, reason: 'tampered' });
    }

    if (data.used) {
      return res.status(200).json({ valid: false, reason: 'already_used' });
    }

    // Mark as used – this makes the link one‑time
    data.used = true;
    await kv.set(`code:${code}`, data);

    return res.status(200).json({ valid: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ valid: false, error: e.message });
  }
}