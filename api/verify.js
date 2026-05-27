import { createDecipheriv, randomBytes } from 'crypto';
import { Redis } from '@upstash/redis';

const keyHex = process.env.NTAG_KEY || '00000000000000000000000000000000';
const keyBuffer = Buffer.from(keyHex, 'hex');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function decryptPicc(piccHex) {
  const piccBuffer = Buffer.from(piccHex, 'hex');
  const decipher = createDecipheriv('aes-128-ecb', keyBuffer, null);
  decipher.setAutoPadding(false);
  let plain = Buffer.concat([decipher.update(piccBuffer), decipher.final()]);
  if (plain.length < 11) throw new Error('Invalid PICC data length');
  const uid = plain.slice(1, 8).toString('hex');
  const cnt = plain.readUIntLE(8, 3);
  return { uid, counter: cnt };
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'https://localhost');
    const allPicc = url.searchParams.getAll('picc_data');
    const piccData = allPicc[allPicc.length - 1];

    if (!piccData || piccData === 'PICC_DATA') {
      return res.redirect('/index-teal.html');
    }

    const { uid, counter } = decryptPicc(piccData);

    // Check / update global counter
    const key = `tap:${uid}`;
    const storedCounter = await redis.get(key);
    if (storedCounter !== null && counter <= storedCounter) {
      return res.redirect('/index-teal.html');
    }
    await redis.set(key, counter);

    // Generate a one‑time code (valid for 10 minutes)
    const code = randomBytes(16).toString('hex');
    await redis.set(`code:${code}`, {
      uid,
      counter,
      used: false,
    }, { ex: 600 });

    return res.redirect(`/nfc-landing.html?code=${code}&uid=${uid}&counter=${counter}&valid=true`);
  } catch (e) {
    console.error(e);
    return res.redirect('/index-teal.html');
  }
}