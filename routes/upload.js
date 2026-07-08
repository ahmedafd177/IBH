const express = require('express');
const multer  = require('multer');
const path    = require('path');
const { createClient } = require('@supabase/supabase-js');
const router  = express.Router();

const BUCKET = process.env.SUPABASE_UPLOAD_BUCKET || 'uploads';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — uploads are stored in Supabase Storage.');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/* Serverless filesystems (Vercel/Netlify) are read-only and ephemeral —
   files must live in memory just long enough to forward to Supabase Storage. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  },
});

/* POST /api/upload */
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const ext  = path.extname(req.file.originalname).toLowerCase();
  const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(name, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

  if (error) return res.status(500).json({ error: `Upload failed: ${error.message}` });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
  res.json({ url: data.publicUrl });
});

module.exports = router;
