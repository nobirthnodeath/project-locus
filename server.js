const express = require("express");
const mongoose = require("mongoose");
const Location = require("./models/location"); // Fix case sensitivity

const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary
require("dotenv").config();
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: "project-locus" } // Images will be stored in this Cloudinary folder
});

const upload = multer({ storage: storage });

const app = express();
const PORT = 3000;

app.use(express.json()); // Middleware to parse JSON requests
app.use(express.static("public"));

// 🟢 Connect to MongoDB
mongoose.connect("mongodb+srv://alec:test@locus-alpha.wz0o7.mongodb.net/simple-api?retryWrites=true&w=majority&appName=Locus-Alpha", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("Connected to MongoDB!"))
  .catch(err => {
      console.error("MongoDB connection error:", err);
      process.exit(1); // Exit on database connection failure
  });

// 🟢 GET all locations
app.get("/locations", async (req, res) => {
    try {
        const locations = await Location.find();
        res.json(locations);
    } catch (err) {
        res.status(500).json({ error: "Error retrieving locations" });
    }
});

// 🟢 POST a new location
app.post("/locations", async (req, res) => {
    try {
        const { title, description, image, tags, lat, lng } = req.body; // Add lat/lng

        if (!title || lat === undefined || lng === undefined) {
            return res.status(400).json({ error: "Title, lat, and lng are required" });
        }

        const newLocation = new Location({ title, description, image, tags, lat, lng }); // Include lat/lng
        await newLocation.save();

        res.status(201).json(newLocation);
    } catch (err) {
        res.status(500).json({ error: "Error saving location" });
    }
});

// 🟢 PATCH route to update a location by title
app.patch("/locations/:title", async (req, res) => {
    try {
        const title = req.params.title; // Get title from URL
        const updates = req.body; // Data to update

        const updatedLocation = await Location.findOneAndUpdate(
            { title: title }, // Find location by title
            { $set: updates }, // Apply updates
            { new: true } // Return updated document
        );

        if (!updatedLocation) {
            return res.status(404).json({ error: "Location not found" });
        }

        res.json(updatedLocation);
    } catch (err) {
        res.status(500).json({ error: "Error updating location" });
    }
});

// 🟢 UPLOAD image when creating a new location
app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file || !req.file.path) {
        return res.status(400).json({ error: "Image upload failed" });
    }
    res.json({ url: req.file.path }); // Send back Cloudinary URL
});

// 🟢 SEARCH locations by multiple tags
app.get("/search", async (req, res) => {
    try {
        const tagsQuery = req.query.tags;

        if (!tagsQuery) {
            return res.status(400).json({ error: "Tags query is required" });
        }

        const tags = tagsQuery.split(","); // Convert string to array

        // Find locations that have *all* selected tags
        const locations = await Location.find({
            tags: { $all: tags }
        });

        res.json(locations);
    } catch (error) {
        console.error("Error filtering by tags:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟢 DELETE a location by ID
app.delete("/locations/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deletedLocation = await Location.findByIdAndDelete(id);

        if (!deletedLocation) {
            return res.status(404).json({ error: "Location not found" });
        }

        res.json({ message: "Location deleted successfully", id });
    } catch (error) {
        console.error("Error deleting location:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟢 GET all unique tags with usage count
app.get("/tags", async (req, res) => {
    try {
        const tags = await Location.aggregate([
            { $unwind: "$tags" },  // Break tags array into separate documents
            { $group: { _id: "$tags", count: { $sum: 1 } } },  // Count occurrences
            { $sort: { count: -1 } } // Sort by most used tags
        ]);

        res.json(tags.map(tag => ({ name: tag._id, count: tag.count })));
    } catch (error) {
        console.error("Error fetching tags:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟢 Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});