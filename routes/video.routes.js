import express from 'express';
import { createVideo, getAllVideos, getVideoById, deleteVideo } from '../controllers/video.controller.js';
import { authorize, protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Create a new video
router.post('/', createVideo);

// Get all videos
router.get('/', getAllVideos);

// Get a video by ID
router.get('/:id', getVideoById);

// Delete a video by ID
router.delete('/:id', protect, authorize("admin"), deleteVideo);

export default router;
