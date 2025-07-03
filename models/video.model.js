import mongoose from "mongoose"

const videoSchema = new mongoose.Schema(
  {
    video: {
      type: String,
        required: [true, "Please provide a video URL"],
    }
    
  },
  { timestamps: true },
)

const Video = mongoose.model("video", videoSchema)

export default Video
