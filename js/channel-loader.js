document.addEventListener('DOMContentLoaded', function() {
    // Load the M3U8 playlist
    loadChannels();

    // Set up event listeners
    setupEventListeners();
});

async function loadChannels() {
    try {
        const response = await fetch('Channel Playlist/playlist.m3u8');
        const data = await response.text();
        const channels = parseM3U8(data);
        displayChannels(channels);
    } catch (error) {
        console.error('Error loading channels:', error);
        document.getElementById('channelGrid').innerHTML = `
            <div class="col-12 text-center">
                <p class="text-danger">Error loading channels. Please try again later.</p>
            </div>
        `;
    }
}

function parseM3U8(data) {
    const lines = data.split('\n');
    const channels = [];
    let currentChannel = null;

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF:')) {
            // Parse channel info
            const info = line.substring(8).split(',');
            const [attributes, name] = info;
            
            // Parse attributes
            const categoryMatch = attributes.match(/group-title="([^"]+)"/);
            const logoMatch = attributes.match(/tvg-logo="([^"]+)"/);
            
            currentChannel = {
                name: name.trim(),
                category: categoryMatch ? categoryMatch[1] : 'Uncategorized',
                logo: logoMatch ? logoMatch[1] : 'img/default-channel.png'
            };
        } else if (line.startsWith('http') && currentChannel) {
            currentChannel.url = line;
            channels.push(currentChannel);
            currentChannel = null;
        }
    });

    return channels;
}

function displayChannels(channels, filter = 'all') {
    const grid = document.getElementById('channelGrid');
    grid.innerHTML = '';

    channels.forEach(channel => {
        if (filter === 'all' || channel.category.toLowerCase() === filter.toLowerCase()) {
            const card = createChannelCard(channel);
            grid.appendChild(card);
        }
    });

    if (grid.children.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center">
                <p>No channels found for the selected category.</p>
            </div>
        `;
    }
}

function createChannelCard(channel) {
    const col = document.createElement('div');
    col.className = 'col-sm-6 col-lg-4 col-xl-3';

    col.innerHTML = `
        <div class="channel-card">
            <div class="channel-thumbnail">
                <img src="${channel.logo}" alt="${channel.name}" onerror="this.src='img/default-channel.png'">
                <span class="live-badge">LIVE</span>
            </div>
            <div class="channel-info">
                <h3 class="channel-title">${channel.name}</h3>
                <span class="channel-category">${channel.category}</span>
            </div>
        </div>
    `;

    // Add click event to play the channel
    col.querySelector('.channel-card').addEventListener('click', () => {
        playChannel(channel);
    });

    return col;
}

function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('[data-category]').forEach(button => {
        button.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            
            // Update active state
            document.querySelectorAll('[data-category]').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');

            // Reload channels with filter
            loadChannels().then(channels => {
                displayChannels(channels, category);
            });
        });
    });

    // Search functionality
    const searchInput = document.getElementById('channelSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.channel-card');

            cards.forEach(card => {
                const title = card.querySelector('.channel-title').textContent.toLowerCase();
                const category = card.querySelector('.channel-category').textContent.toLowerCase();
                const shouldShow = title.includes(searchTerm) || category.includes(searchTerm);
                
                card.closest('.col-sm-6').style.display = shouldShow ? 'block' : 'none';
            });
        });
    }
}

function playChannel(channel) {
    // Implement channel playback logic here
    // This could open a new page with the video player or show a modal
    window.location.href = `player.html?channel=${encodeURIComponent(JSON.stringify(channel))}`;
} 