import { Router } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { location_id } = req.query;
    let query = supabase.from('panoramas').select('*');
    if (location_id) query = query.eq('location_id', location_id);
    const { data, error } = await query.order('id', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('panoramas')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Panorama not found' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { location_id, title, image_url, pitch, yaw, hfov, is_first_scene } = req.body;
  try {
    const { data, error } = await supabase
      .from('panoramas')
      .insert({
        location_id,
        title,
        image_url,
        pitch: pitch ?? 0,
        yaw: yaw ?? 0,
        hfov: hfov ?? 100,
        is_first_scene: is_first_scene ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { title, image_url, pitch, yaw, hfov, is_first_scene } = req.body;
  try {
    const { error } = await supabase
      .from('panoramas')
      .update({ title, image_url, pitch, yaw, hfov, is_first_scene })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Panorama updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('panoramas')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Panorama deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
