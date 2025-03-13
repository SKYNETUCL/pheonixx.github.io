class EPGHandler {
    constructor() {
        this.epgUrl = 'https://raw.githubusercontent.com/SKYNETUCL/SKYNET2-DADDYS/refs/heads/main/SPORTSEPG';
        this.epgData = null;
        this.channelId = this.getChannelIdFromUrl();
        this.channelName = this.getChannelNameFromUrl();
        this.timezoneOffset = 12; // Fiji GMT+12
    }

    getChannelIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    getChannelNameFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('name');
    }

    async init() {
        if (!this.channelId && !this.channelName) {
            console.error('No channel ID or name found in URL');
            return;
        }

        try {
            await this.loadEPGData();
            this.renderEPG();
            this.startAutoRefresh();
            console.log('EPG initialized for channel:', this.channelId || this.channelName);
        } catch (error) {
            console.error('Failed to initialize EPG:', error);
            this.showError('Failed to initialize program guide');
        }
    }

    async loadEPGData() {
        try {
            console.log('Loading EPG data from:', this.epgUrl);
            const response = await fetch(this.epgUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const text = await response.text();
            const parser = new DOMParser();
            this.epgData = parser.parseFromString(text, 'text/xml');
            
            if (this.epgData.querySelector('parsererror')) {
                throw new Error('Failed to parse EPG XML data');
            }
            
            // Sort programs by start time
            const programmes = Array.from(this.epgData.querySelectorAll('programme'));
            programmes.sort((a, b) => {
                const startA = this.parseDateTime(a.getAttribute('start'));
                const startB = this.parseDateTime(b.getAttribute('start'));
                return startA - startB;
            });
            
            console.log('EPG data loaded and sorted');
        } catch (error) {
            console.error('Error loading EPG data:', error);
            throw error;
        }
    }

    parseDateTime(dateStr) {
        if (!dateStr || dateStr.length < 14) {
            console.warn('Invalid date string:', dateStr);
            return null;
        }
        
        try {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6) - 1; // Months are 0-based
            const day = dateStr.substring(6, 8);
            const hour = dateStr.substring(8, 10);
            const minute = dateStr.substring(10, 12);
            const second = dateStr.substring(12, 14);
            const timezone = dateStr.substring(15, 18) + ':' + dateStr.substring(18, 20);
            
            // Create date string in ISO format with timezone
            const formattedDateString = `${year}-${String(month + 1).padStart(2, '0')}-${day}T${hour}:${minute}:${second}${timezone}`;
            return new Date(formattedDateString);
        } catch (error) {
            console.error('Error parsing date:', dateStr, error);
            return null;
        }
    }

    formatTime(date) {
        if (!date) return '--:--';
        const fijiTime = this.toFijiTime(date);
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayOfWeek = daysOfWeek[fijiTime.getDay()];
        
        const timeStr = fijiTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        return `${dayOfWeek} ${timeStr}`;
    }

    getDurationInMinutes(start, stop) {
        if (!start || !stop) return 0;
        const diffInMs = Math.abs(stop - start);
        return Math.floor(diffInMs / (1000 * 60));
    }

    findChannelId(channelName) {
        if (!channelName || !this.epgData) return null;

        const cleanedSearchName = this.cleanChannelName(channelName);
        console.log('Looking for channel:', channelName);
        console.log('Cleaned channel name:', cleanedSearchName);

        // Log all available channels for debugging
        const channels = Array.from(this.epgData.getElementsByTagName('channel'));
        console.log('Available channels:', channels.map(channel => ({
            id: channel.getAttribute('id'),
            names: Array.from(channel.getElementsByTagName('display-name')).map(n => n.textContent)
        })));

        for (const channel of channels) {
            // First, check if this channel has a matching ID
            const channelId = channel.getAttribute('id');
            if (channelId === this.channelId) {
                console.log('Found channel by ID:', this.channelId);
                return channelId;
            }

            // If no ID match, try matching by name
            const displayNames = Array.from(channel.getElementsByTagName('display-name'));
            for (const displayName of displayNames) {
                const name = displayName.textContent;
                const cleanedName = this.cleanChannelName(name);
                
                // Log each comparison for debugging
                console.log('Comparing:', {
                    original: name,
                    cleaned: cleanedName,
                    searchName: cleanedSearchName,
                    exactMatch: cleanedName === cleanedSearchName,
                    includes: cleanedName.includes(cleanedSearchName) || cleanedSearchName.includes(cleanedName)
                });

                if (cleanedName === cleanedSearchName || 
                    cleanedName.includes(cleanedSearchName) || 
                    cleanedSearchName.includes(cleanedName)) {
                    console.log('Found matching channel by name:', name);
                    return channelId;
                }
            }
        }
        
        console.log('No matching channel found');
        return null;
    }

    cleanChannelName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/\b(?:hd|fhd|uhd|4k|hevc|h265|\d+p)\b/g, '')
            .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with space
            .replace(/\s+/g, ' ')         // Normalize spaces
            .trim();
    }

    renderProgram(programme, container, isLive, start, stop) {
        const programDiv = document.createElement('div');
        programDiv.className = `epg-program${isLive ? ' current' : ''}`;

        const title = programme.querySelector('title')?.textContent || 'Untitled';
        const desc = programme.querySelector('desc')?.textContent || '';
        const category = programme.querySelector('category')?.textContent || '';
        const duration = this.getDurationInMinutes(start, stop);
        const durationHours = Math.floor(duration / 60);
        const durationMinutes = duration % 60;
        const durationStr = durationHours > 0 ? 
            `${durationHours}h ${durationMinutes}m` : 
            `${durationMinutes}m`;

        programDiv.innerHTML = `
            ${isLive ? '<div class="live-badge">LIVE</div>' : ''}
            <div class="epg-time">
                <i class="fas fa-clock"></i>
                ${this.formatTime(start)}
                <span class="duration">(${durationStr})</span>
            </div>
            <div class="epg-info">
                <div class="epg-title">${title}</div>
                ${category ? `<div class="epg-category">${category}</div>` : ''}
                ${desc ? `<div class="epg-description">${desc}</div>` : ''}
            </div>
        `;

        container.appendChild(programDiv);
    }

    async renderEPG() {
        const epgPrograms = document.querySelector('.epg-programs');
        if (!epgPrograms || !this.epgData) return;

        try {
            // Log the channel we're looking for
            console.log('Searching for channel:', {
                id: this.channelId,
                name: this.channelName
            });

            // If we have a channel ID, use it directly; otherwise try to find it by name
            const channelId = this.channelId || this.findChannelId(this.channelName);
            if (!channelId) {
                console.log('No channel ID found, showing no programs');
                this.showNoPrograms(epgPrograms);
                return;
            }

            console.log('Found channel ID:', channelId);

            const fijiNow = this.toFijiTime(new Date());
            const programmes = Array.from(this.epgData.querySelectorAll(`programme[channel="${channelId}"]`));
            
            // Log found programmes for debugging
            console.log('Found programmes:', programmes.length);
            console.log('First few programmes:', programmes.slice(0, 3).map(p => ({
                title: p.querySelector('title')?.textContent,
                start: p.getAttribute('start'),
                stop: p.getAttribute('stop')
            })));

            const validProgrammes = programmes
                .map(programme => {
                    const start = this.parseDateTime(programme.getAttribute('start'));
                    const stop = this.parseDateTime(programme.getAttribute('stop'));
                    if (!start || !stop) return null;
                    
                    const fijiStart = this.toFijiTime(start);
                    const fijiStop = this.toFijiTime(stop);
                    
                    return {
                        programme,
                        start: fijiStart,
                        stop: fijiStop,
                        isLive: fijiNow >= fijiStart && fijiNow < fijiStop
                    };
                })
                .filter(item => item !== null && item.stop > fijiNow)
                .sort((a, b) => a.start - b.start)
                .slice(0, 10); // Show next 10 programs

            epgPrograms.innerHTML = '';

            if (!validProgrammes.length) {
                console.log('No valid programmes found');
                this.showNoPrograms(epgPrograms);
                return;
            }

            console.log('Rendering programmes:', validProgrammes.length);
            validProgrammes.forEach(({ programme, start, stop, isLive }) => {
                this.renderProgram(programme, epgPrograms, isLive, start, stop);
            });

            // Add loading state handling
            epgPrograms.classList.remove('loading');
            
            // Update current program in header if available
            const currentProgram = validProgrammes.find(p => p.isLive);
            if (currentProgram) {
                const title = currentProgram.programme.querySelector('title')?.textContent;
                const remaining = Math.ceil((currentProgram.stop - fijiNow) / (1000 * 60));
                
                const durationElement = document.getElementById('broadcastDuration');
                if (durationElement) {
                    durationElement.textContent = `Live - ${remaining}m remaining`;
                }
            }

        } catch (error) {
            console.error('Error rendering EPG:', error);
            this.showError('Failed to load program guide');
        }
    }

    showNoPrograms(container) {
        container.innerHTML = `
            <div class="epg-program no-info">
                <div class="epg-info">
                    <div class="epg-title">No Program Information Available</div>
                    <div class="epg-time">--:-- - --:--</div>
                </div>
            </div>
        `;
    }

    showError(message) {
        const epgPrograms = document.querySelector('.epg-programs');
        if (epgPrograms) {
            epgPrograms.innerHTML = `
                <div class="epg-program error">
                    <div class="epg-info">
                        <div class="epg-title">${message}</div>
                    </div>
                </div>
            `;
        }
    }

    startAutoRefresh() {
        // Update EPG every minute
        setInterval(() => {
            console.log('Refreshing EPG...');
            this.renderEPG();
        }, 60000);
    }

    toFijiTime(date) {
        if (!date) return null;
        const localOffset = date.getTimezoneOffset();
        const fijiOffset = (this.timezoneOffset * 60) + localOffset; // Convert to minutes
        return new Date(date.getTime() + (fijiOffset * 60 * 1000));
    }
}

// Initialize EPG when the page loads
document.addEventListener('DOMContentLoaded', function() {
    const epg = new EPGHandler();
    epg.init();
}); 