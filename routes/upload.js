const express = require('express');
const router = express.Router();
const { upload } = require('../cloudinary');
const authMiddleware = require('../models/Authmiddleware');

router.post('/image', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    res.json({ success: true, url: req.file.path, public_id: req.file.filename });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/video', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    res.json({ success: true, url: req.file.path, public_id: req.file.filename });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/pdf', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    res.json({ success: true, url: req.file.path, public_id: req.file.filename });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;