import { Router } from 'express';

const router = Router();

router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const supabaseUrl = process.env.SUPABASE_URL!;
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/panoramas/${filename}`;

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
