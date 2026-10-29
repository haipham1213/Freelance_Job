import app from './app.js';
import { connectDB } from './config/db.js';
import { sweepExpired } from './modules/jobs/jobs.service.js';

const port = process.env.PORT || 5050;

await connectDB();
const sweep = () => sweepExpired().catch((e) => console.warn(`[sweep] ${e.message}`));
sweep();
setInterval(sweep, 60 * 60_000);
app.listen(port, () => console.log(`API chạy tại http://localhost:${port}`));
