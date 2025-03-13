// Global variables to store channels data
let allChannels = [];
let filteredChannels = [];
let currentFilter = 'all';
let searchQuery = '';

// Constants
const DEFAULT_TV_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2QzdDODkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIyIiB5PSI3IiB3aWR0aD0iMjAiIGhlaWdodD0iMTUiIHJ4PSIyIiByeT0iMiI+PC9yZWN0Pjxwb2x5bGluZSBwb2ludHM9IjE3IDIgMTIgNyA3IDIiPjwvcG9seWxpbmU+PC9zdmc+';
const PLAYLIST_URL = 'https://tinyurl.com/SPORTSTVPRI';
// Display channels in the grid
async function displayChannels() {
    const channelGrid = document.getElementById('channelGrid');
    if (!channelGrid) return;

    try {
        // Fetch and parse the playlist
        const response = await fetch(PLAYLIST_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.text();
        
        // Parse the M3U file
        const channels = parseM3U(data);
        console.log('Parsed channels:', channels.length);

        // Initialize search and filters
        initializeSearch();
        initializeFilterButtons(channels);

        // Group channels by category
        const groupedChannels = {};
        channels.forEach(channel => {
            const group = channel.group || 'Uncategorized';
            if (!groupedChannels[group]) {
                groupedChannels[group] = [];
            }
            groupedChannels[group].push(channel);
        });

        // Clear existing content
        channelGrid.innerHTML = '';

        // Create sections for each group
        Object.entries(groupedChannels).forEach(([group, groupChannels]) => {
            // Create group section
            const groupSection = document.createElement('div');
            groupSection.className = 'channel-group mb-4';
            groupSection.setAttribute('data-group', group);
            
            // Hide events sections by default
            if (group.toLowerCase().includes('event')) {
                groupSection.style.display = 'none';
            }
            
            // Create group header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'category-header';
            groupHeader.innerHTML = `
                <h4 class="category-title">
                    <i class="fas fa-tv me-2"></i>${group}
                    <span class="category-count">${groupChannels.length}</span>
                </h4>
                <div class="category-line"></div>
            `;
            groupSection.appendChild(groupHeader);
            
            // Create grid for channel cards
            const channelContainer = document.createElement('div');
            channelContainer.className = 'channel-grid';
            
            // Add channels in this group
            groupChannels.forEach(channel => {
                const card = createChannelCard(channel);
                channelContainer.appendChild(card);
            });
            
            groupSection.appendChild(channelContainer);
            channelGrid.appendChild(groupSection);
        });

        // Hide spinner after loading
        const spinner = document.getElementById('spinner');
        if (spinner) {
            spinner.classList.remove('show');
        }
    } catch (error) {
        console.error('Error displaying channels:', error);
        showError('Failed to load channels: ' + error.message);
    }
}

// Parse M3U file
function parseM3U(data) {
    const channels = [];
    const lines = data.split('\n');
    let currentChannel = null;

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        if (line.startsWith('#EXTINF:')) {
            // Parse channel info
            currentChannel = {};
            
            // Extract TVG info and group first
            const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupMatch = line.match(/group-title="([^"]*)"/);
            
            // Clean up the channel name by removing the EXTINF part and any tags
            let displayName = line.split(',').pop().trim();
            displayName = displayName
                .replace(/\[.*?\]/g, '') // Remove anything in square brackets
                .replace(/\(.*?\)/g, '') // Remove anything in parentheses
                .replace(/\{.*?\}/g, '') // Remove anything in curly braces
                .replace(/\|.*$/, '')    // Remove anything after a pipe
                .replace(/\b(?:DADDYLIVE|DADDY LIVE|DADDY|LIVE)\b/gi, '') // Remove DADDYLIVE mentions
                .replace(/\b(?:HD|FHD|UHD|4K|HEVC|H265|\d+p)\b/gi, '') // Remove quality tags
                .replace(/\s+/g, ' ')    // Normalize spaces
                .trim();

            // Use TVG name if available and valid, otherwise use cleaned display name
            currentChannel.displayName = (tvgNameMatch && tvgNameMatch[1].trim()) || displayName;
            
            // Clean up the group name
            let group = (groupMatch && groupMatch[1]) || 'Other';
            group = group
                .replace(/\b(?:DADDYLIVE|DADDY LIVE|DADDY|LIVE)\b/gi, '')
                .replace(/\[.*?\]/g, '')
                .replace(/\(.*?\)/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            currentChannel.tvg = {
                name: tvgNameMatch ? tvgNameMatch[1] : '',
                id: tvgIdMatch ? tvgIdMatch[1] : ''
            };
            currentChannel.logo = tvgLogoMatch ? tvgLogoMatch[1] : '';
            currentChannel.group = group || 'Other';
            
        } else if (line.startsWith('http') && currentChannel) {
            // Add URL and push channel
            currentChannel.url = line;
            channels.push(currentChannel);
            currentChannel = null;
        }
    });

    // Sort channels by group and then by name
    return channels.sort((a, b) => {
        if (a.group === b.group) {
            return a.displayName.localeCompare(b.displayName);
        }
        return a.group.localeCompare(b.group);
    });
}

// Create channel card element
function createChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'fade-in';
    card.setAttribute('data-group', channel.group || '');
    
    // Safely get the channel ID, falling back to empty string if not available
    const channelId = channel.tvg && channel.tvg.id ? channel.tvg.id : '';
    
    const link = `player-new.html?url=${encodeURIComponent(channel.url)}&id=${encodeURIComponent(channelId)}&name=${encodeURIComponent(channel.displayName)}&logo=${encodeURIComponent(channel.logo || '')}`;
    
    const cardHtml = `
        <div class="channel-item shadow-sm rounded overflow-hidden">
            <div class="channel-img position-relative">
                <img src="${channel.logo || DEFAULT_TV_ICON}" alt="${channel.displayName}"
                     onerror="this.src='${DEFAULT_TV_ICON}'"
                     loading="lazy">
                <div class="channel-overlay d-flex align-items-center justify-content-center">
                    <a href="${link}" class="btn btn-primary btn-sm px-3">
                        <i class="fas fa-play me-1"></i>Watch
                    </a>
                </div>
            </div>
            <div class="channel-text">
                <h5 class="channel-name" title="${channel.displayName}">
                    ${channel.displayName}
                </h5>
                <div class="channel-meta">
                    <small>
                        <i class="fas fa-tv me-1 text-primary"></i>${channel.group || 'Unknown'}
                    </small>
                    <small class="text-primary">
                        <i class="fas fa-signal"></i>
                    </small>
                </div>
            </div>
        </div>
    `;
    
    card.innerHTML = cardHtml;
    return card;
}

// Filter channels
function filterChannels(filter = 'all') {
    const channelGroups = document.querySelectorAll('.channel-group');
    
    channelGroups.forEach(group => {
        const groupName = group.getAttribute('data-group').toLowerCase();
        if (filter === 'all') {
            // Hide events sections when showing all channels
            group.style.display = groupName.includes('event') ? 'none' : '';
        } else {
            // Show the group if it matches the filter
            group.style.display = groupName.includes(filter.toLowerCase()) ? '' : 'none';
        }
    });
}

// Search channels
function searchChannels(query) {
    const channelGroups = document.querySelectorAll('.channel-group');
    const searchTerm = query.toLowerCase();
    
    channelGroups.forEach(group => {
        const groupName = group.getAttribute('data-group').toLowerCase();
        const channelNames = Array.from(group.querySelectorAll('.channel-name'))
            .map(el => el.textContent.toLowerCase());
        
        // Show the group if any channel matches or group name matches
        const hasMatch = channelNames.some(name => name.includes(searchTerm)) || 
                        groupName.includes(searchTerm);
                        
        // Don't show events in search unless explicitly searching for them
        if (groupName.includes('event')) {
            group.style.display = (hasMatch && searchTerm.includes('event')) ? '' : 'none';
        } else {
            group.style.display = hasMatch ? '' : 'none';
        }
    });
}

// Initialize filter buttons
function initializeFilterButtons(channels) {
    const filterButtons = document.getElementById('filterButtons');
    const groups = new Set(channels.map(channel => channel.group).filter(Boolean));
    
    groups.forEach(group => {
        const button = document.createElement('button');
        button.className = 'btn btn-outline-primary btn-sm filter-btn';
        button.setAttribute('data-filter', group);
        button.textContent = group;
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            filterChannels(group);
        });
        filterButtons.appendChild(button);
    });
}

// Initialize search
function initializeSearch() {
    const searchInput = document.getElementById('channelSearch');
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchChannels(e.target.value);
        }, 300);
    });
}

// Show error message
function showError(message) {
    console.error('Showing error:', message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'col-12 alert alert-danger text-center';
    errorDiv.innerHTML = `
        <h4 class="alert-heading">Error Loading Channels</h4>
        <p>${message}</p>
        <hr>
        <p class="mb-0">
            <button onclick="location.reload()" class="btn btn-outline-danger">
                <i class="fas fa-sync-alt me-2"></i>Try Again
            </button>
        </p>
    `;
    
    const channelGrid = document.getElementById('channelGrid');
    if (channelGrid) {
        channelGrid.innerHTML = '';
        channelGrid.appendChild(errorDiv);
    }
    
    // Hide spinner
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.classList.remove('show');
    }
}

// Reset filters
function resetFilters() {
    searchQuery = '';
    currentFilter = 'all';
    
    // Reset search input
    const searchInput = document.getElementById('channelSearch');
    if (searchInput) searchInput.value = '';
    
    // Reset filter buttons
    const filterButtons = document.getElementById('filterButtons');
    if (filterButtons) {
        filterButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-filter') === 'all') {
                btn.classList.add('active');
            }
        });
    }
    
    displayChannels();
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, initializing channels');
    displayChannels();
}); 