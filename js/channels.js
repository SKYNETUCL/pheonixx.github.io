// Function to parse m3u8 playlist
async function parseM3U8Playlist() {
    try {
        console.log('Fetching local playlist...');
        // Try to fetch from the correct path
        let response = await fetch('Channel Playlist/playlist.m3u8');
        
        if (!response.ok) {
            // Try alternate path
            response = await fetch('../Channel Playlist/playlist.m3u8');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        
        const playlistContent = await response.text();
        console.log('Playlist content length:', playlistContent.length);
        console.log('First 500 chars of playlist:', playlistContent.substring(0, 500));
        
        const channels = [];
        const lines = playlistContent.split('\n');
        let currentChannel = null;

        console.log('Total lines in playlist:', lines.length);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                try {
                    console.log('Processing EXTINF line:', line);
                    // Extract the part after the last comma which is the actual channel name
                    const lastCommaIndex = line.lastIndexOf(',');
                    if (lastCommaIndex === -1) continue;

                    const rawName = line.substring(lastCommaIndex + 1).trim();
                    const attributes = line.substring(0, lastCommaIndex);

                    // Extract attributes
                    const tvgName = attributes.match(/tvg-name="([^"]+)"/)?.[1];
                    const tvgLogo = attributes.match(/tvg-logo="([^"]+)"/)?.[1];
                    const groupTitle = attributes.match(/group-title="([^"]+)"/)?.[1];
                    const tvgId = attributes.match(/tvg-id="([^"]+)"/)?.[1];

                    // Use tvg-name if available, otherwise use the raw name
                    const name = tvgName || rawName;
                    const id = tvgId || name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

                    const category = standardizeCategory(groupTitle, name);

                    currentChannel = {
                        id: id,
                        name: name,
                        thumbnail: tvgLogo || 'img/channel-placeholder.jpg',
                        category: category,
                        isLive: true,
                        viewers: Math.floor(Math.random() * 20000 + 5000),
                        quality: 'FHD'
                    };

                    console.log('Created channel object:', currentChannel);

                } catch (e) {
                    console.error('Error parsing channel:', line, e);
                }
            } else if (line.startsWith('http')) {
                if (currentChannel) {
                    console.log('Found stream URL for channel:', currentChannel.name, line);
                    // Store stream URLs in a global object for easy access
                    if (!window.streamUrls) window.streamUrls = {};
                    window.streamUrls[currentChannel.id] = line;
                    
                    // Update URL format to match player expectations
                    currentChannel.url = `player.html?id=${encodeURIComponent(currentChannel.id)}&name=${encodeURIComponent(currentChannel.name)}`;
                    channels.push({...currentChannel});
                    currentChannel = null;
                }
            }
        }

        // Store channels globally
        window.channels = channels;
        console.log('Successfully loaded channels:', channels.length);
        console.log('Stream URLs loaded:', Object.keys(window.streamUrls).length);
        console.log('First channel example:', channels[0]);
        console.log('First stream URL example:', window.streamUrls[channels[0]?.id]);

        return channels;

    } catch (error) {
        console.error('Error loading playlist:', error);
        console.error('Stack trace:', error.stack);
        return getFallbackChannels();
    }
}

// Function to get stream URL by channel ID
function getStreamUrl(channelId) {
    console.log('Getting stream URL for channel ID:', channelId);
    console.log('Available stream URLs:', Object.keys(window.streamUrls || {}));
    
    if (!window.streamUrls) {
        console.error('Stream URLs not loaded');
        return null;
    }
    
    const url = window.streamUrls[channelId];
    if (!url) {
        console.error('No stream URL found for channel:', channelId);
        console.log('Available channels:', window.channels.map(c => ({ id: c.id, name: c.name })));
    } else {
        console.log('Found stream URL:', url);
    }
    return url;
}

function standardizeCategory(category, channelName) {
    channelName = (channelName || '').toUpperCase();
    category = (category || '').toLowerCase().trim();

    const categoryMap = {
        'sports': [
            'SPORTS', 'ESPN', 'FOX SPORTS', 'NBC SPORTS', 'BEIN', 'TSN',
            'ACC NETWORK', 'BIG TEN', 'MLB', 'NBA', 'NFL', 'NHL', 'UFC'
        ],
        'news': [
            'NEWS', 'ABC', 'CBS', 'NBC', 'FOX', 'CNN', 'BBC', 'MSNBC', 
            'NEWSMAX', 'WEATHER', 'CNBC', 'BLOOMBERG'
        ],
        'movies': [
            'MOVIES', 'CINEMA', 'FILM', 'HBO', 'SHOWTIME', 'STARZ', 'CINEMAX',
            'AMC', 'TCM', 'PARAMOUNT', 'FX', 'TNT'
        ],
        'entertainment': [
            'ENTERTAINMENT', 'USA', 'TBS', 'BRAVO', 'E!', 'COMEDY', 
            'LIFETIME', 'A&E', 'TLC', 'HGTV', 'FOOD'
        ],
        'kids': [
            'KIDS', 'DISNEY', 'NICKELODEON', 'NICK', 'CARTOON', 'PBS KIDS',
            'BOOMERANG'
        ]
    };

    for (const [standardCategory, keywords] of Object.entries(categoryMap)) {
        if (keywords.some(keyword => channelName.includes(keyword))) {
            return standardCategory;
        }
    }

    return category || 'entertainment';
}

function getFallbackChannels() {
    return [
        {
            id: 'bbc1',
            name: 'BBC One',
            thumbnail: 'img/channels/bbc1.jpg',
            category: 'entertainment',
            isLive: true,
            viewers: 15243,
            quality: '1080p',
            url: 'player.html?channel=bbc1'
        },
        {
            id: 'sky_sports',
            name: 'Sky Sports',
            thumbnail: 'img/channels/sky_sports.jpg',
            category: 'sports',
            isLive: true,
            viewers: 25832,
            quality: '1080p',
            url: 'player.html?channel=sky_sports'
        },
        {
            id: 'cnn',
            name: 'CNN',
            thumbnail: 'img/channels/cnn.jpg',
            category: 'news',
            isLive: true,
            viewers: 12421,
            quality: '720p',
            url: 'player.html?channel=cnn'
        },
        {
            id: 'hbo',
            name: 'HBO',
            thumbnail: 'img/channels/hbo.jpg',
            category: 'movies',
            isLive: true,
            viewers: 18632,
            quality: '1080p',
            url: 'player.html?channel=hbo'
        },
        {
            id: 'disney',
            name: 'Disney Channel',
            thumbnail: 'img/channels/disney.jpg',
            category: 'kids',
            isLive: true,
            viewers: 8912,
            quality: '720p',
            url: 'player.html?channel=disney'
        }
    ];
}

// Initialize the channel grid
async function initializeChannels() {
    const channelGrid = document.getElementById('channelGrid');
    const searchInput = document.getElementById('channelSearch');
    const categoryButtons = document.querySelectorAll('.category-filters .btn');
    let currentCategory = 'all';
    let searchQuery = '';

    // Show loading state
    channelGrid.innerHTML = `
        <div class="channel-grid-loading">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading channels...</span>
            </div>
            <p class="lead">Loading channels...</p>
        </div>
    `;

    try {
        // Load channels from playlist
        const channels = await parseM3U8Playlist();
        window.channels = channels; // Store globally

        // Function to render channel cards
        function renderChannels(filteredChannels) {
            channelGrid.innerHTML = '';
            
            if (filteredChannels.length === 0) {
                channelGrid.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-search fa-2x text-primary mb-3"></i>
                        <p class="lead">No channels found matching your criteria</p>
                    </div>
                `;
                return;
            }

            filteredChannels.forEach(channel => {
                const card = document.createElement('div');
                card.className = 'channel-card';
                card.setAttribute('data-category', channel.category);
                
                card.innerHTML = `
                    <div class="channel-thumbnail">
                        <img src="${channel.thumbnail}" alt="${channel.name}" 
                             onerror="this.src='img/placeholder.png'"
                             loading="lazy">
                    </div>
                    <div class="channel-info">
                        <h3 class="channel-title" title="${channel.name}">${channel.name}</h3>
                        <span class="channel-category">${channel.category.charAt(0).toUpperCase() + channel.category.slice(1)}</span>
                        <div class="channel-meta">
                            <span><i class="fas fa-signal"></i>${channel.quality}</span>
                        </div>
                        <a href="${channel.url}" class="btn btn-primary w-100">
                            <i class="fas fa-play"></i>Watch
                        </a>
                    </div>
                `;
                
                // Make the entire card clickable
                card.style.cursor = 'pointer';
                card.onclick = function(e) {
                    // Prevent default behavior
                    e.preventDefault();
                    // Only navigate if not clicking the button
                    if (!e.target.closest('.btn')) {
                        window.location.href = channel.url;
                    }
                };
                
                // Make the Watch Now button work separately
                const watchButton = card.querySelector('.btn');
                watchButton.onclick = function(e) {
                    e.stopPropagation(); // Prevent card click
                    window.location.href = channel.url;
                };
                
                channelGrid.appendChild(card);
            });

            // Initialize animations
            if (typeof WOW !== 'undefined') {
                new WOW().init();
            }
        }

        // Format viewer count
        function formatViewers(count) {
            if (count >= 1000000) {
                return (count / 1000000).toFixed(1) + 'M';
            } else if (count >= 1000) {
                return (count / 1000).toFixed(1) + 'K';
            }
            return count.toString();
        }

        // Filter channels based on category and search query
        function filterChannels() {
            let filtered = channels;
            
            if (currentCategory !== 'all') {
                filtered = filtered.filter(channel => channel.category === currentCategory);
            }
            
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filtered = filtered.filter(channel => 
                    channel.name.toLowerCase().includes(query) ||
                    channel.category.toLowerCase().includes(query)
                );
            }
            
            return filtered;
        }

        // Event listeners
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderChannels(filterChannels());
        });

        categoryButtons.forEach(button => {
            button.addEventListener('click', () => {
                categoryButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentCategory = button.dataset.category;
                renderChannels(filterChannels());
            });
        });

        // Initial render
        renderChannels(channels);

    } catch (error) {
        console.error('Error initializing channels:', error);
        channelGrid.innerHTML = `
            <div class="channel-grid-error">
                <i class="fas fa-exclamation-circle"></i>
                <p class="lead">Failed to load channels. Please try again.</p>
                <button class="btn btn-primary" onclick="initializeChannels()">
                    <i class="fas fa-redo me-2"></i>Try Again
                </button>
            </div>
        `;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeChannels);

// Load more functionality
document.getElementById('loadMoreBtn').addEventListener('click', function() {
    // Add logic to load more channels
    this.classList.add('disabled');
    this.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Loading...
    `;
    
    // Simulate loading delay
    setTimeout(() => {
        this.classList.remove('disabled');
        this.innerHTML = `
            Load More Channels
            <i class="fas fa-chevron-down ms-2"></i>
        `;
    }, 1500);
}); 