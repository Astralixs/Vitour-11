import { Router } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Location not found' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, description, cover_image } = req.body;
  try {
    const { data, error } = await supabase
      .from('locations')
      .insert({ name, description, cover_image })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, description, cover_image } = req.body;
  try {
    const { error } = await supabase
      .from('locations')
      .update({ name, description, cover_image })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Location updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Location deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/tour', async (req, res) => {
  try {
    const { data: panoramas, error } = await supabase
      .from('panoramas')
      .select('*')
      .eq('location_id', req.params.id);
    if (error) throw error;

    const scenes: any = {};

    for (const pan of panoramas) {
      const { data: hotspots } = await supabase
        .from('hotspots')
        .select('*')
        .eq('panorama_id', pan.id);

      const filename = new URL(pan.image_url).pathname.split('/').pop();
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const proxyBase = `${protocol}://${req.get('host')}`;
      scenes[pan.id] = {
        type: 'equirectangular',
        panorama: `${proxyBase}/api/images/${encodeURIComponent(filename || '')}`,
        crossOrigin: 'anonymous',
        title: pan.title,
        pitch: pan.pitch,
        yaw: pan.yaw,
        hfov: pan.hfov,
        autoRotate: -2,
        loadTimeout: 60000,
        hotSpots: (hotspots || []).map((hs: any) => ({
          pitch: hs.pitch,
          yaw: hs.yaw,
          type: hs.type,
          text: hs.text,
          ...(hs.type === 'scene' && { sceneId: String(hs.target_panorama_id) }),
        })),
      };
    }

    const firstScene = panoramas.find((p: any) => p.is_first_scene) || panoramas[0];

    res.json({
      default: { firstScene: firstScene ? String(firstScene.id) : null },
      scenes,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
