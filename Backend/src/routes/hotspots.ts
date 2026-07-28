import { Router } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { panorama_id } = req.query;
    let query = supabase.from('hotspots').select('*');
    if (panorama_id) query = query.eq('panorama_id', panorama_id);
    const { data, error } = await query.order('id', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { panorama_id, type, pitch, yaw, text, target_panorama_id } = req.body;
  try {
    const { data, error } = await supabase
      .from('hotspots')
      .insert({
        panorama_id,
        type: type ?? 'info',
        pitch,
        yaw,
        text,
        target_panorama_id: target_panorama_id ?? null,
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
  const { type, pitch, yaw, text, target_panorama_id } = req.body;
  try {
    const { error } = await supabase
      .from('hotspots')
      .update({ type, pitch, yaw, text, target_panorama_id })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Hotspot updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('hotspots')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Hotspot deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
