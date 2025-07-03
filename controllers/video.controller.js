import Video from '../models/video.model.js';

// Create a new video

export const createVideo = async (req, res) => {
  try {
    // Check if there are already 5 videos
    const videoCount = await Video.countDocuments();
    if (videoCount >= 5) {
      return res.status(400).json({ success: false, message: 'Maximum of 5 videos allowed. Please delete an existing video before adding a new one.' });
    }
    const { video } = req.body;
    if (!video) {
      return res.status(400).json({ success: false, message: 'Video URL is required' });
    }
    const newVideo = await Video.create({ video });
    res.status(201).json({ success: true, data: newVideo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all videos
export const getAllVideos = async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a video by ID
export const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }
    res.status(200).json({ success: true, data: video });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a video by ID
export const deleteVideo = async (req, res) => {
  try {
    const video = await Video.findByIdAndDelete(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }
    res.status(200).json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
