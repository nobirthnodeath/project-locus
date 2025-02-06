// Initialize the map
const map = L.map('map').setView([33.4484, -112.0740], 13); // Phoenix, AZ

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 🟢 Fetch locations from API and add markers
async function loadLocations() {
    try {
        const response = await fetch('/locations');
        const locations = await response.json();

        locations.forEach(loc => {
            if (loc.lat && loc.lng) {
                const marker = L.marker([loc.lat, loc.lng]).addTo(map);
                
                // 🟢 Create a delete button inside the popup
                const popupContent = `
                    <b>${loc.title}</b><br>${loc.description}
                    <br><button onclick="deleteLocation('${loc._id}', ${loc.lat}, ${loc.lng})">🗑️ Delete</button>
                `;

                marker.bindPopup(popupContent);
            }
        });
    } catch (error) {
        console.error("Error loading locations:", error);
    }
}

// Load tags from the backend and display them
async function loadTags() {
    try {
        const response = await fetch('/tags'); // Fetch tags from backend
        const tags = await response.json();

        const popularTagsContainer = document.getElementById("popular-tags");
        const allTagsContainer = document.getElementById("all-tags");

        // Clear previous tags
        popularTagsContainer.innerHTML = "";
        allTagsContainer.innerHTML = "";

        // Sort tags by usage (most used first)
        tags.sort((a, b) => b.count - a.count);

        // Show the top 5 popular tags
        const popularTags = tags.slice(0, 5);
        popularTags.forEach(tag => {
            let tagElement = document.createElement("span");
            tagElement.classList.add("tag");
            tagElement.textContent = tag.name;
            tagElement.onclick = () => filterByTag(tag.name);
            popularTagsContainer.appendChild(tagElement);
        });

        // Show all tags (hidden initially)
        tags.forEach(tag => {
            let tagElement = document.createElement("span");
            tagElement.classList.add("tag");
            tagElement.textContent = tag.name;
            tagElement.onclick = () => filterByTag(tag.name);
            allTagsContainer.appendChild(tagElement);
        });

    } catch (error) {
        console.error("Error loading tags:", error);
    }
}

// 🟢 Show all tags when clicking "Show All"
document.getElementById("show-all-tags").addEventListener("click", function () {
    const allTagsContainer = document.getElementById("all-tags");
    allTagsContainer.style.display = (allTagsContainer.style.display === "none") ? "block" : "none";
});

// 🟢 Filter locations by tag
let activeTags = new Set(); // Store selected tags

// 🟢 Toggle tag selection
function toggleTag(tag) {
    if (activeTags.has(tag)) {
        activeTags.delete(tag); // Remove tag if already selected
    } else {
        activeTags.add(tag); // Add tag if not selected
    }
    updateTagUI(); // Update tag colors
    filterByTags(); // Filter locations
}

// 🟢 Update tag UI to show active filters
function updateTagUI() {
    document.querySelectorAll(".tag").forEach(tagElement => {
        if (activeTags.has(tagElement.textContent)) {
            tagElement.style.backgroundColor = "#28a745"; // Green for active tags
        } else {
            tagElement.style.backgroundColor = "#007bff"; // Default blue
        }
    });
}

// 🟢 Fetch and filter locations based on selected tags
async function filterByTags() {
    if (activeTags.size === 0) {
        loadLocations(); // If no filters, show all locations
        return;
    }

    try {
        const query = Array.from(activeTags).join(",");
        const response = await fetch(`/search?tags=${encodeURIComponent(query)}`);
        const locations = await response.json();
        updateMapWithResults(locations);
    } catch (error) {
        console.error("Error filtering locations:", error);
    }
}

// 🟢 Modify tag click event to support multi-tag filtering
async function loadTags() {
    try {
        const response = await fetch('/tags');
        const tags = await response.json();

        const popularTagsContainer = document.getElementById("popular-tags");
        const allTagsContainer = document.getElementById("all-tags");

        popularTagsContainer.innerHTML = "";
        allTagsContainer.innerHTML = "";

        tags.sort((a, b) => b.count - a.count); // Sort by popularity

        const popularTags = tags.slice(0, 5);
        popularTags.forEach(tag => {
            let tagElement = document.createElement("span");
            tagElement.classList.add("tag");
            tagElement.textContent = tag.name;
            tagElement.onclick = () => toggleTag(tag.name);
            popularTagsContainer.appendChild(tagElement);
        });

        tags.forEach(tag => {
            let tagElement = document.createElement("span");
            tagElement.classList.add("tag");
            tagElement.textContent = tag.name;
            tagElement.onclick = () => toggleTag(tag.name);
            allTagsContainer.appendChild(tagElement);
        });

    } catch (error) {
        console.error("Error loading tags:", error);
    }
}

// Call loadTags() when the page loads
loadTags();

// Call loadTags() when the page loads
loadTags();

// Load locations on page load
loadLocations();

// 🟢 Handle Search Input
document.getElementById("searchBox").addEventListener("input", async function (event) {
    const searchQuery = event.target.value.trim();

    if (searchQuery.length === 0) {
        loadLocations(); // Reload all locations when search is cleared
        return;
    }

    try {
        const response = await fetch(`/search?query=${encodeURIComponent(searchQuery)}`);
        const locations = await response.json();

        updateMapWithResults(locations);
    } catch (error) {
        console.error("Error fetching search results:", error);
    }
});

// 🟢 Function to Update Map with Search Results
function updateMapWithResults(locations) {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer); // Remove existing markers
        }
    });

    locations.forEach(loc => {
        if (loc.lat && loc.lng) {
            L.marker([loc.lat, loc.lng])
                .addTo(map)
                .bindPopup(`<b>${loc.title}</b><br>${loc.description}`);
        }
    });
}

// 🟢 Handle Map Click & Show Modal
let selectedLat, selectedLng; // Store clicked coordinates

map.on('click', function (event) {
    selectedLat = event.latlng.lat;
    selectedLng = event.latlng.lng;

    // Show the modal form
    document.getElementById("locationModal").style.display = "flex";
});

// 🟢 Handle Form Submission (Adding New Location)
document.getElementById("saveLocation").addEventListener("click", async function () {
    const title = document.getElementById("title").value;
    const description = document.getElementById("description").value;
    const imageInput = document.getElementById("image").files[0]; // Get selected file

    if (!title) {
        alert("Title is required!");
        return;
    }

    let imageUrl = ""; // Placeholder for uploaded image URL

    if (imageInput) {
        // Convert image to Base64
        const formData = new FormData();
        formData.append("image", imageInput);

        // Upload image to backend
        try {
            const imgResponse = await fetch('/upload', {
                method: "POST",
                body: formData
            });
            const imgData = await imgResponse.json();
            imageUrl = imgData.url; // Assuming backend returns the image URL
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Image upload failed.");
            return;
        }
    }

    // Send new location to the backend
    fetch('/locations', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, lat: selectedLat, lng: selectedLng, image: imageUrl })
    })
    .then(response => response.json())
    .then(data => {
        console.log("Location saved:", data);

        // Add marker immediately with image
        let popupContent = `<b>${title}</b><br>${description}`;
        if (imageUrl) {
            popupContent += `<br><img src="${imageUrl}" width="100" style="border-radius: 5px;">`;
        }

        L.marker([selectedLat, selectedLng])
            .addTo(map)
            .bindPopup(popupContent);

        // Close modal and clear fields
        document.getElementById("locationModal").style.display = "none";
        document.getElementById("title").value = "";
        document.getElementById("description").value = "";
        document.getElementById("image").value = "";
    })
    .catch(error => console.error("Error saving location:", error));
});

// 🟢 Close Modal When Clicking "X"
document.querySelector(".close-btn").addEventListener("click", function () {
    document.getElementById("locationModal").style.display = "none";
});

// 🟢 Delete a location from the database & remove from the map
async function deleteLocation(id, lat, lng) {
    console.log("Attempting to delete location with ID:", id); // Debugging

    if (!confirm("Are you sure you want to delete this location?")) return;

    try {
        const response = await fetch(`/locations/${id}`, {
            method: "DELETE",
        });

        console.log("Server Response:", response.status); // Log response status

        if (response.ok) {
            console.log("Location deleted successfully");

            // 🟢 Remove marker from the map
            map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    const { lat: layerLat, lng: layerLng } = layer.getLatLng();
                    if (layerLat === lat && layerLng === lng) {
                        map.removeLayer(layer);
                    }
                }
            });
        } else {
            console.error("Failed to delete location:", await response.text());
        }
    } catch (error) {
        console.error("Error deleting location:", error);
    }
}