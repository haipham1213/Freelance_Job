import app from './app.js';
import { connectDB } from './config/db.js';

const port = process.env.PORT || 5050;

await connectDB();
app.listen(port, () => console.log(`API chạy tại http://localhost:${port}`));
