const mongoose = require("mongoose");

const LocationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    image: String, // Cloudinary URL
    tags: [String],
    lat: { type: Number, required: true },  // Latitude
    lng: { type: Number, required: true },  // Longitude
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true } // Associate with User
}, { timestamps: true }); // Automatically adds createdAt and updatedAt timestamps

const Location = mongoose.model("Location", LocationSchema);
module.exports = Location;