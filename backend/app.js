require('dotenv').config();
const express = require('express');
const db = require('./db');
const authRoutes = require('./routes/auth');
const coachRoutes = require('./routes/coaches');
const courseRoutes = require('./routes/courses');
const scheduleRoutes = require('./routes/schedules');
const appointmentRoutes = require('./routes/appointments');
const reviewRoutes = require('./routes/reviews');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

app.get('/api/health', async (req, res, next) => {
  try {
    await db.query('SELECT 1');
    res.json({ message: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/coaches', coachRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reviews', reviewRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: error.message || '服务器开小差了' });
});

const server = app.listen(port, () => {
  console.log(`server is running at http://127.0.0.1:${port}`);
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用，请关闭占用进程或修改 .env 中的 PORT`);
    process.exit(1);
  }

  throw error;
});