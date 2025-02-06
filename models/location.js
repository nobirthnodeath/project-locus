const mongoose = require("mongoose");

const LocationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    image: String,
    tags: [String],
    lat: Number,  // Add latitude
    lng: Number   // Add longitude
});

module.exports = mongoose.model("Location", LocationSchema);