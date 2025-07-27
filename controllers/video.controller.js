import Video from '../models/video.model.js';
import { v2 as cloudinary } from 'cloudinary';


const extractPublicIdFromUrl = (url) => {
  try {
    // Cloudinary URLs typically look like:
    // https://res.cloudinary.com/cloud_name/video/upload/v1234567890/folder/filename.ext
    // We need to extract the public_id which includes folder/filename (without extension)
    
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex === -1) {
      throw new Error('Invalid Cloudinary URL format');
    }
    
    // Get everything after 'upload' and version number (if present)
    let publicIdParts = urlParts.slice(uploadIndex + 1);
    
    // Remove version number if present (starts with 'v' followed by numbers)
    if (publicIdParts[0] && publicIdParts[0].match(/^v\d+$/)) {
      publicIdParts = publicIdParts.slice(1);
    }
    
    // Join the remaining parts and remove file extension
    const publicIdWithExt = publicIdParts.join('/');
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // Remove extension
    
    return publicId;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
};

// Create a new video
export const createVideo = async (req, res) => {
  try {
    // Check if there are already 5 videos
    const videoCount = await Video.countDocuments();
    if (videoCount >= 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum of 5 videos allowed. Please delete an existing video before adding a new one.' 
      });
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

// Delete a video by ID (Updated to also delete from Cloudinary)
export const deleteVideo = async (req, res) => {
  try {
    // First, find the video to get the Cloudinary URL
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Extract public_id from the Cloudinary URL
    const publicId = extractPublicIdFromUrl(video.video);
    
    if (publicId) {
      try {
        // Delete from Cloudinary
        const cloudinaryResult = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'video' // Specify that it's a video file
        });
        
        console.log('Cloudinary deletion result:', cloudinaryResult);
        
        if (cloudinaryResult.result !== 'ok') {
          console.warn('Cloudinary deletion failed:', cloudinaryResult);
          // You can choose to continue with DB deletion or return an error
          // For now, we'll continue with DB deletion even if Cloudinary deletion fails
        }
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
        // You can choose to return an error or continue with DB deletion
        // For now, we'll continue with DB deletion
      }
    } else {
      console.warn('Could not extract public_id from URL:', video.video);
    }

    // Delete from database
    await Video.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ 
      success: true, 
      message: 'Video deleted successfully from both database and Cloudinary' 
    });
  } catch (error) {
    console.error('Error in deleteVideo:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};