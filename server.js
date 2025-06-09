import express from 'express';
import cors from 'cors';
import { NTPClient } from 'ntpclient';

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
app.listen(port, () => {
  console.log(`NTP API server running at http://localhost:${port}`);
});
