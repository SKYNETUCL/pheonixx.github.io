// Make sure channels array is available
if (typeof channels === 'undefined') {
    console.error('Channels array not found! Make sure channels.js is loaded before tv-player.js');
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing channel...');
    initializeChannel();
    updateStreamStats();
});

function getChannelParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = {
        id: urlParams.get('id'),
        name: decodeURIComponent(urlParams.get('name') || '')
    };
    console.log('Channel params:', params);
    return params;
}

function updateStreamStats() {
    const viewerCount = document.getElementById('viewerCount');
    const streamQuality = document.getElementById('streamQuality');
    
    if (!viewerCount || !streamQuality) {
        console.error('Required elements not found');
        return;
    }
    
    try {
        // Simulate dynamic viewer count
        setInterval(() => {
            const baseCount = Math.floor(Math.random() * 5000) + 1000;
            viewerCount.textContent = baseCount.toLocaleString();
        }, 5000);
        
        // Set fixed quality for now since all streams are HD/FHD
        streamQuality.textContent = 'FHD';
    } catch (error) {
        console.error('Error in updateStreamStats:', error);
    }
}

function showStreamError(message) {
    console.error('Stream error:', message);
    const streamLoading = document.getElementById('streamLoading');
    const streamError = document.getElementById('streamError');
    const videoContainer = document.getElementById('videoContainer');
    
    if (streamLoading) streamLoading.style.display = 'none';
    if (videoContainer) videoContainer.style.display = 'none';
    if (streamError) {
        const errorMessage = streamError.querySelector('p');
        if (errorMessage) errorMessage.textContent = message;
        streamError.style.display = 'block';
    }
}

function retryStream() {
    console.log('Retrying stream...');
    const streamError = document.getElementById('streamError');
    const streamLoading = document.getElementById('streamLoading');
    const videoContainer = document.getElementById('videoContainer');
    
    if (streamError) streamError.style.display = 'none';
    if (streamLoading) streamLoading.style.display = 'flex';
    if (videoContainer) videoContainer.style.display = 'block';
    
    initializeChannel();
}

function initializeChannel() {
    const { id, name } = getChannelParams();
    if (!id || !name) {
        showStreamError('Invalid channel parameters');
        return;
    }

    console.log('Initializing channel:', { id, name });
    
    // Update channel title immediately
    const channelTitle = document.getElementById('channelTitle');
    if (channelTitle) {
        channelTitle.textContent = decodeURIComponent(name);
    }
    
    // Make sure channels array is loaded
    if (!window.channels || !window.channels.length) {
        console.error('Channels not loaded yet, fetching playlist...');
        parseM3U8Playlist().then(channels => {
            window.channels = channels;
            setupStream(id, name);
        }).catch(error => {
            console.error('Failed to load channels:', error);
            showStreamError('Failed to load channel data');
        });
    } else {
        setupStream(id, name);
    }
}

function setupStream(id, name) {
    console.log('Setting up stream for:', { id, name });

    const videoContainer = document.getElementById('videoContainer');
    if (!videoContainer) {
        console.error('Video container not found');
        return;
    }

    // Create new video player
    const videoPlayer = document.createElement('video');
    videoPlayer.id = 'videoPlayer';
    videoPlayer.className = 'video-player';
    videoPlayer.controls = true;
    videoPlayer.autoplay = true;
    videoPlayer.muted = true;
    videoContainer.innerHTML = ''; // Clear existing content
    videoContainer.appendChild(videoPlayer);

    const streamLoading = document.getElementById('streamLoading');
    if (streamLoading) streamLoading.style.display = 'flex';

    try {
        const streamUrl = getStreamUrl(id);
        console.log('Stream URL:', streamUrl);
        
        if (!streamUrl) {
            showStreamError('Stream URL not found');
            return;
        }

        console.log('Attempting to play stream:', streamUrl);

        if (Hls.isSupported()) {
            const hls = new Hls({
                debug: true, // Enable debug logs
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });

            hls.loadSource(streamUrl);
            hls.attachMedia(videoPlayer);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS manifest parsed, attempting playback');
                if (streamLoading) streamLoading.style.display = 'none';
                
                videoPlayer.play()
                    .then(() => {
                        console.log('Playback started successfully');
                        setTimeout(() => {
                            videoPlayer.muted = false;
                        }, 1000);
                    })
                    .catch(error => {
                        console.error('Playback failed:', error);
                        showStreamError('Failed to start playback. Please try again.');
                    });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            showStreamError('Network error occurred. Please check your connection.');
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            showStreamError('Media playback error. Please try again.');
                            break;
                        default:
                            showStreamError('Playback error occurred. Please try again.');
                            break;
                    }
                }
            });
        } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            // For Safari
            videoPlayer.src = streamUrl;
            videoPlayer.addEventListener('loadedmetadata', () => {
                if (streamLoading) streamLoading.style.display = 'none';
                videoPlayer.play()
                    .catch(error => {
                        console.error('Native playback failed:', error);
                        showStreamError('Failed to start playback. Please try again.');
                    });
            });
        } else {
            showStreamError('HLS playback is not supported in this browser');
        }
    } catch (error) {
        console.error('Error setting up stream:', error);
        showStreamError('Failed to initialize stream. Please try again.');
    }
}

// Handle quality selection
document.getElementById('qualitySelector')?.addEventListener('change', function(e) {
    console.log('Quality changed to:', e.target.value);
    // Quality switching is handled automatically by HLS.js
});

// Handle stream refresh
document.getElementById('refreshStream')?.addEventListener('click', function() {
    console.log('Refreshing stream...');
    retryStream();
}); 