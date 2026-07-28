import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import locationsRouter from './routes/locations';
import panoramasRouter from './routes/panoramas';
import hotspotsRouter from './routes/hotspots';
import imagesRouter from './routes/images';

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

app.use('/api/locations', locationsRouter);
app.use('/api/panoramas', panoramasRouter);
app.use('/api/hotspots', hotspotsRouter);
app.use('/api/images', imagesRouter);

export default app;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
