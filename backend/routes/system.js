import express from 'express';
import { supabase } from '../db/supabase.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const start = Date.now();
    // Validate database connection
    const { data, error } = await supabase.from('vehicles').select('id').limit(1);
    
    if (error) throw error;
    
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - start
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      error: 'Database connection failed',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
