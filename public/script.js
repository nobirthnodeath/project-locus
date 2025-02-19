// Initialize the map
const map = L.map('map').setView([33.4484, -112.0740], 13); // Phoenix, AZ
addUserLocationMarker(); // Show user's location

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 🟢 Fetch locations from API and add markers
let currentPage = 1; // Track current page

async function loadLocations(page = 1) {
    currentPage = page; // Update current page

    const token = localStorage.getItem("token");
    const response = await fetch(`/locations?page=${page}`, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    const data = await response.json();
    const locations = data.locations;
    
    // 🟢 Clear existing markers before adding new ones
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    locations.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng]).addTo(map);
    
        let popupContent = `
            <div class="popup-container">
                <div class="popup-image-container">
                    <img src="${loc.image}" class="popup-image" alt="${loc.title}">
                    <div class="popup-close-btn" onclick="closePopup()">✖</div>
                </div>
                <div class="popup-text">
                    <h3 class="popup-title">${loc.title}</h3>
                    <p class="popup-description">${loc.description || ""}</p>
                    <div class="popup-tags">
                        ${loc.tags.map(tag => `<span class="popup-tag" onclick="filterByTag('${tag}')">${tag}</span>`).join(" ")}
                    </div>
                </div>
            </div>
        `;
    
        marker.bindPopup(popupContent, { closeButton: false });
    });

    updatePaginationControls(data.totalPages);
}

// 🟢 Pagination controls
function changePage(direction) {
    let newPage = currentPage + direction;

    if (newPage < 1) return; // Prevent going below page 1

    loadLocations(newPage);
}

function updatePaginationControls(totalPages) {
    document.getElementById("pageIndicator").textContent = `Page ${currentPage} of ${totalPages}`;

    document.getElementById("prevPage").disabled = currentPage === 1;
    document.getElementById("nextPage").disabled = currentPage >= totalPages;
}

// 🟢 Filter by tag when tag is clicked
async function filterByTag(tag) {
    console.log("🔍 Filtering by tag:", tag);

    try {
        const token = localStorage.getItem("token");

        const response = await fetch(`/search?query=${encodeURIComponent(tag)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const locations = await response.json();
        console.log("🟢 Locations matching tag:", locations);

        updateMapWithResults(locations);
    } catch (error) {
        console.error("❌ Error filtering locations by tag:", error);
    }
}

// Call this function on page load
loadLocations();

// Load tags from the backend and display them
async function loadTags() {
    try {
        const token = localStorage.getItem("token");

        if (!token) {
            console.error("❌ No authentication token found!");
            return;
        }

        const response = await fetch('/tags', {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const tags = await response.json();

        if (!Array.isArray(tags)) {
            console.error("❌ Error loading tags: Expected an array but got:", tags);
            return;
        }

        const popularTagsContainer = document.getElementById("popular-tags");

        if (!popularTagsContainer) {
            console.error("❌ Element with ID 'popular-tags' not found in the DOM.");
            return;
        }

        popularTagsContainer.innerHTML = ""; // Clear previous tags

        tags.forEach(tag => {
            let tagElement = document.createElement("span");
            tagElement.classList.add("tag", "clickable-tag");
            tagElement.textContent = `${tag.name} (${tag.count})`;
            tagElement.onclick = () => filterByTag(tag.name);
            popularTagsContainer.appendChild(tagElement);
        });

        console.log("✅ Tags successfully added to UI.");

    } catch (error) {
        console.error("❌ Error loading tags:", error);
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
        console.log("🔍 Searching for:", searchQuery);
        const token = localStorage.getItem("token");

        const response = await fetch(`/search?query=${encodeURIComponent(searchQuery)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const locations = await response.json();
        console.log("🟢 Search results:", locations);

        updateMapWithResults(locations);
    } catch (error) {
        console.error("❌ Error fetching search results:", error);
    }
});

// 🟢 Function to Update Map with Search Results
function updateMapWithResults(locations) {
    // Remove existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    // Add new markers from search results
    locations.forEach(loc => {
        if (loc.lat && loc.lng) {
            let popupContent = `<b>${loc.title}</b><br>${loc.description}`;

            if (loc.image) {
                popupContent += `<br><img src="${loc.image}" width="100" style="border-radius: 5px;">`;
            }
            if (loc.tags && loc.tags.length > 0) {
                popupContent += `<br><small>Tags: ${loc.tags.join(", ")}</small>`;
            }

            L.marker([loc.lat, loc.lng])
                .addTo(map)
                .bindPopup(popupContent);
        }
    });
}

// 🟢 Fetch and display locations for the logged-in user
async function loadMyLocations() {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("You must be logged in to view your locations.");
        return;
    }

    try {
        console.log("🔹 Fetching my locations...");
        const response = await fetch("/my-locations", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const locations = await response.json();
        console.log("🟢 My Locations:", locations);

        // 🟢 Clear existing markers before adding new ones
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        locations.forEach(loc => {
            const marker = L.marker([loc.lat, loc.lng]).addTo(map);
            let popupContent = `<b>${loc.title}</b><br>${loc.description}`;

            if (loc.image) {
                popupContent += `<br><img src="${loc.image}" width="100" style="border-radius: 5px;">`;
            }
            if (loc.tags && loc.tags.length > 0) {
                popupContent += `<br><small>Tags: ${loc.tags.join(", ")}</small>`;
            }

            marker.bindPopup(popupContent);
        });

    } catch (error) {
        console.error("❌ Error fetching user locations:", error);
    }
}

// event listener for the above function
document.getElementById("myLocationsBtn").addEventListener("click", function () {
    const isShowingMyLocations = this.classList.toggle("active");

    if (isShowingMyLocations) {
        this.textContent = "Show All Locations";
        loadMyLocations();
    } else {
        this.textContent = "My Locations";
        loadLocations();
    }
});

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
    const imageInput = document.getElementById("image").files[0];
    const tagsInput = document.getElementById("tags").value; // Get tags input

    if (!title) {
        alert("Title is required!");
        return;
    }

    let imageUrl = "";

    if (imageInput) {
        const formData = new FormData();
        formData.append("image", imageInput);
    
        try {
            const token = localStorage.getItem("token");
    
            const imgResponse = await fetch('/upload', {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`  // ✅ Add token here
                },
                body: formData
            });
    
            const imgData = await imgResponse.json();
            console.log("🟢 Image upload response:", imgData);
            imageUrl = imgData.url; 
    
            if (!imageUrl) {
                console.error("❌ Image URL missing in response");
                alert("Image upload failed.");
                return;
            }
    
        } catch (error) {
            console.error("❌ Error uploading image:", error);
            alert("Image upload failed.");
            return;
        }
    }

    // ✅ Convert comma-separated tags into an array
    const tags = tagsInput.split(",").map(tag => tag.trim()).filter(tag => tag !== "");

    const token = localStorage.getItem("token");

    fetch('/locations', {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ title, description, lat: selectedLat, lng: selectedLng, image: imageUrl, tags })
    })
    .then(response => response.json())
    .then(data => {
        console.log("Location saved:", data);

        // 🟢 Add marker immediately with tags
        let popupContent = `<b>${title}</b><br>${description}`;
        if (imageUrl) {
            popupContent += `<br><img src="${imageUrl}" width="100" style="border-radius: 5px;">`;
        }
        if (tags.length > 0) {
            popupContent += `<br><small>Tags: ${tags.join(", ")}</small>`;
        }

        L.marker([selectedLat, selectedLng])
            .addTo(map)
            .bindPopup(popupContent);

        document.getElementById("locationModal").style.display = "none";
        document.getElementById("title").value = "";
        document.getElementById("description").value = "";
        document.getElementById("image").value = "";
        document.getElementById("tags").value = ""; // Clear tags input
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

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const logoutBtn = document.getElementById("logout-btn");

    const showSignup = document.getElementById("show-signup");
    const showLogin = document.getElementById("show-login");

    // Toggle between login and signup forms
    showSignup.addEventListener("click", () => {
        loginForm.style.display = "none";
        signupForm.style.display = "block";
    });

    showLogin.addEventListener("click", () => {
        loginForm.style.display = "block";
        signupForm.style.display = "none";
    });

    // Handle Sign-up
    document.getElementById("signup-btn").addEventListener("click", async () => {
        const username = document.getElementById("signup-username").value;
        const email = document.getElementById("signup-email").value;
        const password = document.getElementById("signup-password").value;

        const response = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        if (data.token) {
            localStorage.setItem("token", data.token);
            alert("Signup successful! You are now logged in.");
            window.location.reload();
        } else {
            alert(data.error || "Signup failed");
        }
    });

    // Handle Login
    document.getElementById("login-btn").addEventListener("click", async () => {
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (data.token) {
            localStorage.setItem("token", data.token);
            alert("Login successful!");
            window.location.reload();
        } else {
            alert(data.error || "Login failed");
        }
    });

    // Handle Logout
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        alert("Logged out successfully!");
        window.location.reload();
    });

    // Auto-show logout button if logged in
    const token = localStorage.getItem("token");
    if (token) {
        loginForm.style.display = "none";
        signupForm.style.display = "none";
        logoutBtn.style.display = "block";
    }
});

// 🟢 Close popup when clicking the close button
function closePopup() {
    map.closePopup(); // Closes any open popup
}

// 🟢 Display user's location mark on the map
function addUserLocationMarker() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            console.log(`📍 User Location: ${userLat}, ${userLng}`);

            // Create a marker for the user
            const userMarker = L.marker([userLat, userLng], {
                icon: L.icon({
                    iconUrl: "https://cdn-icons-png.flaticon.com/512/447/447031.png", // User icon
                    iconSize: [32, 32], // Icon size
                    iconAnchor: [16, 32], // Positioning
                })
            }).addTo(map);

            userMarker.bindPopup("<b>You are here</b>").openPopup();
        },
        (error) => {
            console.error("❌ Error getting location:", error);
            alert("Unable to retrieve your location.");
        }
    );
}