import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'https://localhost');
    const uid = url.searchParams.get('uid');
    const counter = url.searchParams.get('counter');

    if (!uid || !counter) {
      return res.status(400).json({ valid: false, error: 'Missing parameters' });
    }

    // Check if this exact link has already been used
    const usedKey = `used:${uid}:${counter}`;
    const alreadyUsed = await kv.get(usedKey);
    if (alreadyUsed) {
      return res.status(200).json({ valid: false, reason: 'already_used' });
    }

    // Also verify that the counter is not older than the latest one
    const latestKey = `tap:${uid}`;
    const storedCounter = await kv.get(latestKey);
    if (storedCounter !== null && parseInt(counter) < storedCounter) {
      return res.status(200).json({ valid: false, reason: 'outdated' });
    }

    // Mark this link as used so it cannot be viewed again
    await kv.set(usedKey, '1');

    return res.status(200).json({ valid: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ valid: false, error: e.message });
  }
}