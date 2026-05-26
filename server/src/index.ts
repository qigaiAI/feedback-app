import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import groupRoutes from './routes/groups';
import feedbackRoutes from './routes/feedbacks';
import tagRoutes from './routes/tags';
import templateRoutes from './routes/template';
import templatesRoutes from './routes/templates';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/feedbacks', feedbackRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/template', templateRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Feedback server running on port ${PORT}`);
});
