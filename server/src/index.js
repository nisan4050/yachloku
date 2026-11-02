import express from 'express';
import pg from 'pg';

const { DATABASE_URL, PORT = 3000 } = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('select 1 as ok');
    res.json({ status: 'ok', db: rows[0].ok === 1 });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

app.listen(PORT, () => console.log(`yachloku-api listening on ${PORT}`));
