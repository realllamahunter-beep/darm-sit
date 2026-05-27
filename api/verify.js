import { createDecipheriv, randomBytes } from 'crypto';
import { Redis } from '@upstash/redis';

const keyHex = process.env.NTAG_KEY || '00000000000000000000000000000000';
const keyBuffer = Buffer.from(keyHex, 'hex');

// Connect to Redis using environment variables
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const url = new URL(req.url, 'https://localhost');
  const allPicc = url.searchParams.getAll('picc_data');
  const piccData = allPicc[allPicc.length - 1];

  // If no tap data, test Redis connectivity
  if (!piccData || piccData === 'PICC_DATA') {
    try {
      const testKey = 'test-connection';
      await redis.set(testKey, 'ok');
      const testVal = await redis.get(testKey);
      return res.status(200).json({
        mode: 'redis-test',
        redisConnected: testVal === 'ok',
        upstashUrlSet: !!process.env.UPSTASH_REDIS_REST_URL,
        upstashTokenSet: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch (e) {
      return res.status(200).json({
        mode: 'redis-test',
        redisError: e.message,
      });
    }
  }

  // Decrypt the PICC data
  try {
    const piccBuffer = Buffer.from(piccData, 'hex');
    const decipher = createDecipheriv('aes-128-ecb', keyBuffer, null);
    decipher.setAutoPadding(false);
    let plain = Buffer.concat([decipher.update(piccBuffer), decipher.final()]);
    if (plain.length < 11) throw new Error('Invalid PICC data length');
    const uid = plain.slice(1, 8).toString('hex');
    const counter = plain.readUIntLE(8, 3);

    // Try to read/write to Redis
    const tapKey = `tap:${uid}`;
    const stored = await redis.get(tapKey);
    await redis.set(tapKey, counter); // temporary – just for test

    return res.status(200).json({
      mode: 'decrypt',
      uid,
      counter,
      storedCounter: stored,
      redisWorking: true,
      keyFirst6: keyHex.substring(0, 6),
      keyLast6: keyHex.slice(-6),
    });
  } catch (e) {
    return res.status(200).json({
      mode: 'decrypt',
      error: e.message,
    });
  }
}