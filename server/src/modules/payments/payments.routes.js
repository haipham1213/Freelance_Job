import { Router } from 'express';
import Plan from '../../models/Plan.js';
import { ok } from '../../utils/http.js';
import { TIERS } from '../jobs/jobs.service.js';

const router = Router();

// API-45
router.get('/plans', async (req, res) => ok(res, await Plan.find({ isActive: true }).sort('price'), { tiers: TIERS }));

export default router;
