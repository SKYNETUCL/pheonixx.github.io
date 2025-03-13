// Player configuration and state
let hls = null;
let player = null;
let currentStream = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing player...');
    
    // Get stream parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const streamUrl = decodeURIComponent(urlParams.get('url') || '');
    const channelName = decodeURIComponent(urlParams.get('name') || '');
    const channelLogo = decodeURIComponent(urlParams.get('logo') || '');

    // Update channel info
    document.getElementById('channelName').textContent = channelName || 'Unknown Channel';
    document.title = `${channelName || 'Live Stream'} - Live TV`;

    if (streamUrl && streamUrl.trim()) {
        console.log('Starting stream with URL:', streamUrl);
        setupStream(streamUrl);
    } else {
        console.error('No stream URL provided');
        showStreamError('No valid stream URL provided');
    }

    // Add event listeners for controls
    document.getElementById('reloadStream')?.addEventListener('click', function() {
        console.log('Refreshing stream...');
        retryStream();
    });

    document.getElementById('toggleFullscreen')?.addEventListener('click', toggleFullscreen);
});

function setupStream(streamUrl) {
    console.log('Setting up stream:', streamUrl);
    currentStream = streamUrl;

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
        if (!streamUrl) {
            showStreamError('Stream URL not found');
            return;
        }

        console.log('Attempting to play stream:', streamUrl);

        if (Hls.isSupported()) {
            // Destroy existing HLS instance if any
            if (hls) {
                hls.destroy();
                hls = null;
            }

            hls = new Hls({
                debug: true,
                enableWorker: true,
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
        }
        // For browsers with native HLS support (Safari)
        else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            videoPlayer.src = streamUrl;
            videoPlayer.addEventListener('loadedmetadata', () => {
                if (streamLoading) streamLoading.style.display = 'none';
                videoPlayer.play()
                    .then(() => {
                        setTimeout(() => {
                            videoPlayer.muted = false;
                        }, 1000);
                    })
                    .catch(error => {
                        console.error('Native playback failed:', error);
                        showStreamError('Failed to start playback. Please try again.');
                    });
            });
        } else {
            showStreamError('HLS playback is not supported in this browser');
        }

        // Add player event listeners
        videoPlayer.addEventListener('playing', () => {
            console.log('Video playing');
            if (streamLoading) streamLoading.style.display = 'none';
            hideStreamError();
        });

        videoPlayer.addEventListener('waiting', () => {
            console.log('Video buffering');
            if (streamLoading) streamLoading.style.display = 'flex';
        });

        videoPlayer.addEventListener('error', (e) => {
            console.error('Player error:', e);
            showStreamError('Failed to play stream. Please try again.');
        });

    } catch (error) {
        console.error('Error setting up stream:', error);
        showStreamError('Failed to initialize stream. Please try again.');
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

function hideStreamError() {
    const streamError = document.getElementById('streamError');
    const videoContainer = document.getElementById('videoContainer');
    
    if (streamError) streamError.style.display = 'none';
    if (videoContainer) videoContainer.style.display = 'block';
}

function retryStream() {
    const streamError = document.getElementById('streamError');
    const streamLoading = document.getElementById('streamLoading');
    const videoContainer = document.getElementById('videoContainer');
    
    if (streamError) streamError.style.display = 'none';
    if (streamLoading) streamLoading.style.display = 'flex';
    if (videoContainer) videoContainer.style.display = 'block';
    
    if (currentStream) {
        setupStream(currentStream);
    }
}

function toggleFullscreen() {
    const container = document.getElementById('videoContainer');
    
    if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Handle fullscreen changes
document.addEventListener('fullscreenchange', function() {
    const fullscreenButton = document.getElementById('toggleFullscreen');
    if (fullscreenButton) {
        const icon = fullscreenButton.querySelector('i');
        if (icon) {
            icon.className = document.fullscreenElement ? 'fas fa-compress' : 'fas fa-expand';
        }
    }
}); 