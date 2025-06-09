import express from 'express';
import cors from 'cors';
import { NTPClient } from 'ntpclient';
import https from 'https';
import fs from 'fs';

const app = express();
app.use(cors());

app.get('/api/ntp', async (req, res) => {
  const host = req.query.host;
  if (!host) return res.status(400).json({ error: 'host required' });
  try {
    const client = new NTPClient(host, 123);
    const time = await client.getNetworkTime();
    res.json({ time: time.toISOString(), host });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

const port = 3001;
const sslOptions = {
  key: fs.readFileSync('./localhost-key.pem'),
  cert: fs.readFileSync('./localhost-cert.pem'),
};

https.createServer(sslOptions, app).listen(port, '0.0.0.0', () => {
  console.log(`NTP API server running at https://localhost:${port}`);
});
