import { Router } from 'express';
import { authMiddleware } from '../middleware';

const router = Router();

router.get('/gif/search', authMiddleware, async (req: any, res: any) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  if (!q) return res.status(400).json({ error: 'Missing query' });
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey || apiKey === 'your_giphy_api_key_here')
    return res.status(503).json({ error: 'GIF service not configured' });
  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g&lang=fr`;
    const response = await fetch(url);
    const data: any = await response.json();
    const gifs = (data.data || []).map((r: any) => ({
      id: r.id,
      url: r.images?.original?.url || '',
      preview: r.images?.fixed_height_small?.url || r.images?.original?.url || '',
      title: r.title || '',
    }));
    res.json({ gifs });
  } catch (e) {
    console.error('Giphy error:', e);
    res.status(500).json({ error: 'Failed to fetch GIFs' });
  }
});

export default router;
