// EPG Manager Class
class EPGManager {
    constructor() {
        this.epgUrl = 'https://raw.githubusercontent.com/dtankdempse/daddylive-m3u/refs/heads/main/playlist.m3u8';
        this.epgXmlUrl = 'https://raw.githubusercontent.com/dtankdempse/daddylive-m3u/refs/heads/main/epg.xml';
        this.container = document.getElementById('epg-container');
        this.loadingElement = document.getElementById('loadingAnimation');
        this.errorElement = document.getElementById('errorState');
        this.searchInput = document.getElementById('channelSearch');
        this.filterButtons = document.querySelectorAll('.filter-button');
        this.currentFilter = 'all';
        this.channels = [];
        this.epgData = new Map(); // Store EPG data by channel ID
        
        // Constants for layout
        this.HOURS_TO_DISPLAY = 24;
        this.MINUTES_PER_UNIT = 30;
        this.PIXELS_PER_UNIT = 120;
        this.MIN_PROGRAM_WIDTH = 50;
        this.CHANNEL_WIDTH = 160;
        
        this.init();
    }

    async init() {
        try {
            this.showLoading();
            this.setupEventListeners();
            // Load XML EPG data first
            await this.loadXMLEPG();
            // Then load M3U8 data to match with EPG
            await this.loadEPGData();
            this.createLayout();
            this.startTimeTracking();
            this.hideLoading();
        } catch (error) {
            console.error('Failed to initialize EPG:', error);
            this.showError('Failed to load TV guide');
        }
    }

    async loadXMLEPG() {
        try {
            const response = await fetch(this.epgXmlUrl);
            if (!response.ok) throw new Error('Failed to fetch EPG XML');
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            // Parse channels and programs
            const channels = xmlDoc.getElementsByTagName('channel');
            Array.from(channels).forEach(channel => {
                const id = channel.getAttribute('id');
                const displayName = channel.querySelector('display-name')?.textContent;
                const icon = channel.querySelector('icon')?.getAttribute('src');
                
                this.epgData.set(id, {
                    id,
                    displayName,
                    icon,
                    programs: []
                });
            });
            
            // Parse programs and sort by start time
            const programs = Array.from(xmlDoc.getElementsByTagName('programme'));
            programs.sort((a, b) => {
                const startA = this.parseDateTime(a.getAttribute('start'));
                const startB = this.parseDateTime(b.getAttribute('start'));
                return startA - startB;
            });
            
            programs.forEach(program => {
                const channelId = program.getAttribute('channel');
                const channelData = this.epgData.get(channelId);
                
                if (channelData) {
                    const start = this.parseDateTime(program.getAttribute('start'));
                    const stop = this.parseDateTime(program.getAttribute('stop'));
                    
                    if (start && stop) {
                        channelData.programs.push({
                            title: program.querySelector('title')?.textContent || 'No Title',
                            description: program.querySelector('desc')?.textContent || '',
                            start,
                            stop,
                            category: program.querySelector('category')?.textContent || ''
                        });
                    }
                }
            });
            
            console.log('Loaded EPG data for', this.epgData.size, 'channels');
        } catch (error) {
            console.error('Error loading EPG XML:', error);
            throw error;
        }
    }

    parseDateTime(dateStr) {
        if (!dateStr) return null;
        
        // XMLTV dates are in format YYYYMMDDHHMMSS +0000
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(8, 10);
        const minute = dateStr.substring(10, 12);
        const second = dateStr.substring(12, 14);
        
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    }

    async parseM3U8(data) {
        const lines = data.split('\n');
        let currentChannel = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                const channelInfo = this.parseExtInf(line);
                const urlLine = lines[++i]?.trim();
                
                if (urlLine && !urlLine.startsWith('#')) {
                    // First try to find EPG data by tvg-id
                    let epgMatch = null;
                    if (channelInfo.tvgId) {
                        epgMatch = this.epgData.get(channelInfo.tvgId);
                    }
                    
                    // If no match by ID, try name matching
                    if (!epgMatch) {
                        epgMatch = this.findEPGMatch(channelInfo.name);
                    }
                    
                    currentChannel = {
                        id: channelInfo.tvgId || String(this.channels.length + 1),
                        name: channelInfo.name,
                        logo: channelInfo.logo,
                        url: urlLine,
                        category: channelInfo.group || 'Uncategorized',
                        programs: epgMatch ? epgMatch.programs : []
                    };
                    
                    // Log for debugging
                    console.log('Channel:', channelInfo.name, 'EPG Match:', epgMatch ? 'Yes' : 'No');
                    
                    this.channels.push(currentChannel);
                }
            }
        }
    }

    findEPGMatch(channelName) {
        if (!channelName) return null;
        
        // Clean up channel name for matching
        const cleanName = channelName.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '')
            .replace(/hd$/, ''); // Remove HD suffix
            
        // Try to find a matching channel in EPG data
        for (const [_, channelData] of this.epgData) {
            const epgName = channelData.displayName?.toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[^a-z0-9]/g, '')
                .replace(/hd$/, '');
                
            if (epgName === cleanName) {
                return channelData;
            }
        }
        
        // Try partial matching if exact match fails
        for (const [_, channelData] of this.epgData) {
            const epgName = channelData.displayName?.toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[^a-z0-9]/g, '')
                .replace(/hd$/, '');
                
            if (epgName?.includes(cleanName) || cleanName.includes(epgName)) {
                return channelData;
            }
        }
        
        return null;
    }

    setupEventListeners() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.handleSearch());
        }
        
        this.filterButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentFilter = btn.dataset.category;
                this.filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterChannels();
            });
        });
    }

    async loadEPGData() {
        try {
            const response = await fetch(this.epgUrl);
            if (!response.ok) throw new Error('Failed to fetch EPG data');
            const data = await response.text();
            await this.parseM3U8(data);
        } catch (error) {
            console.error('Error loading EPG:', error);
            throw error;
        }
    }

    parseExtInf(line) {
        const info = {
            name: '',
            logo: '',
            group: 'Uncategorized',
            tvgId: ''
        };

        try {
            // Extract tvg-id
            const tvgIdMatch = line.match(/tvg-id=["']?([^"',\s]+)["']?/i);
            if (tvgIdMatch) {
                info.tvgId = tvgIdMatch[1];
            }

            // Extract tvg-name
            const tvgNameMatch = line.match(/tvg-name=["']?([^"',]+)["']?/i);
            if (tvgNameMatch) {
                info.name = tvgNameMatch[1];
            }

            // Extract tvg-logo
            const logoMatch = line.match(/tvg-logo=["']?([^"',\s]+)["']?/i);
            if (logoMatch) {
                info.logo = logoMatch[1];
            }

            // Extract group-title
            const groupMatch = line.match(/group-title=["']?([^"',]+)["']?/i);
            if (groupMatch) {
                info.group = groupMatch[1];
            }

            // Get the channel name after the last comma if no tvg-name
            if (!info.name) {
                const lastCommaIndex = line.lastIndexOf(',');
                if (lastCommaIndex !== -1) {
                    info.name = line.substring(lastCommaIndex + 1).trim();
                }
            }

            // Clean up the name
            info.name = info.name
                .replace(/\.[A-Z]+\.us.*?,/g, '')
                .replace(/tvg-[^,]+/g, '')
                .replace(/group-title=[^,]+/g, '')
                .replace(/[",]/g, '')
                .trim();
        } catch (error) {
            console.error('Error parsing EXTINF line:', error);
        }

        return info;
    }

    createLayout() {
        if (!this.container) return;
        
        // Clear existing content
        this.container.innerHTML = '';
        
        // Create EPG wrapper
        const epgWrapper = document.createElement('div');
        epgWrapper.className = 'epg-wrapper';
        
        // Create EPG table structure
        const table = document.createElement('div');
        table.className = 'epg-table';
        
        // Create timeline
        const timeline = this.createTimeline();
        table.appendChild(timeline);
        
        // Create channel grid container
        const channelGrid = document.createElement('div');
        channelGrid.className = 'channel-grid';
        
        // Create channel rows
        this.channels.forEach(channel => {
            const row = this.createChannelRow(channel);
            channelGrid.appendChild(row);
        });
        
        table.appendChild(channelGrid);
        epgWrapper.appendChild(table);
        this.container.appendChild(epgWrapper);
        
        // Add time indicator
        this.updateTimeIndicator();
    }

    createTimeline() {
        const timeline = document.createElement('div');
        timeline.className = 'timeline';
        
        // Add channel column spacer
        const spacer = document.createElement('div');
        spacer.className = 'timeline-spacer';
        spacer.style.width = `${this.CHANNEL_WIDTH}px`;
        timeline.appendChild(spacer);
        
        // Create timeline slots container
        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'timeline-slots';
        
        const now = new Date();
        now.setMinutes(0, 0, 0);
        
        for (let i = 0; i < this.HOURS_TO_DISPLAY; i++) {
            const time = new Date(now.getTime() + i * 3600000);
            const slot = document.createElement('div');
            slot.className = 'timeline-slot';
            slot.textContent = this.formatTimeSlot(time);
            slotsContainer.appendChild(slot);
        }
        
        timeline.appendChild(slotsContainer);
        return timeline;
    }

    createChannelRow(channel) {
        const row = document.createElement('div');
        row.className = 'row';
        row.dataset.category = channel.category?.toLowerCase() || 'all';
        
        // Create channel box (fixed width column)
        const channelBox = this.createChannelBox(channel);
        row.appendChild(channelBox);
        
        // Create programs wrapper (scrollable area)
        const programsWrapper = document.createElement('div');
        programsWrapper.className = 'programs-wrapper';
        
        // Create programs container (for absolute positioning)
        const programsContainer = document.createElement('div');
        programsContainer.className = 'programs-container';
        
        // Add programs
        if (channel.programs && channel.programs.length > 0) {
            const sortedPrograms = [...channel.programs].sort((a, b) => a.start - b.start);
            const now = new Date();
            const dayStart = new Date(now.setHours(0, 0, 0, 0));
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            
            const todayPrograms = sortedPrograms.filter(program => 
                program.start >= dayStart && program.start < dayEnd
            );
            
            if (todayPrograms.length > 0) {
                todayPrograms.forEach(program => {
                    const programElement = this.createProgramElement(program);
                    programsContainer.appendChild(programElement);
                });
            } else {
                this.addNoDataProgram(programsContainer, channel.name, dayStart, dayEnd);
            }
        } else {
            const now = new Date();
            const dayStart = new Date(now.setHours(0, 0, 0, 0));
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            this.addNoDataProgram(programsContainer, channel.name, dayStart, dayEnd);
        }
        
        programsWrapper.appendChild(programsContainer);
        row.appendChild(programsWrapper);
        return row;
    }

    addNoDataProgram(container, channelName, start, stop) {
        const noDataProgram = {
            title: 'No Program Data',
            start,
            stop,
            description: `No program information available for ${channelName}`
        };
        const programElement = this.createProgramElement(noDataProgram);
        container.appendChild(programElement);
    }

    createProgramElement(program) {
        const element = document.createElement('div');
        element.className = 'program';
        
        if (this.isCurrentlyLive(program.start, program.stop)) {
            element.classList.add('live');
        }
        
        const content = document.createElement('div');
        content.className = 'program-content';
        
        const title = document.createElement('div');
        title.className = 'program-title';
        title.textContent = program.title;
        
        const time = document.createElement('div');
        time.className = 'program-time';
        time.textContent = `${this.formatTimeSlot(program.start)} - ${this.formatTimeSlot(program.stop)}`;
        
        content.appendChild(title);
        content.appendChild(time);
        element.appendChild(content);
        
        if (program.description) {
            element.title = program.description;
        }
        
        // Calculate position and width
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        
        const localStart = new Date(program.start);
        const localStop = new Date(program.stop);
        
        const startMinutes = Math.max(0, (localStart - dayStart) / 60000);
        const endMinutes = Math.min(1440, (localStop - dayStart) / 60000);
        const duration = endMinutes - startMinutes;
        
        const timeSlotWidth = this.PIXELS_PER_UNIT;
        const leftPosition = (startMinutes / 60) * timeSlotWidth;
        const width = Math.max((duration / 60) * timeSlotWidth, this.MIN_PROGRAM_WIDTH);
        
        element.style.left = `${leftPosition}px`;
        element.style.width = `${width}px`;
        
        element.dataset.start = program.start.toISOString();
        element.dataset.stop = program.stop.toISOString();
        
        return element;
    }

    getChannelInitials(name) {
        if (!name || typeof name !== 'string') {
            return 'UC'; // Return 'UC' for Unknown Channel
        }
        
        const words = name.trim().split(/\s+/);
        if (words.length === 0) return 'UC';
        
        if (words.length === 1) {
            // If single word, take first two letters
            return words[0].substring(0, 2).toUpperCase();
        }
        
        // Otherwise take first letter of first two words
        return words.slice(0, 2)
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase();
    }

    formatTimeSlot(date) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    isCurrentlyLive(start, stop) {
        const now = new Date();
        return now >= start && now < stop;
    }

    updateTimeIndicator() {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const minutesSinceStart = (now - dayStart) / 60000;
        const position = (minutesSinceStart / 1440) * 100;
        
        let indicator = this.container.querySelector('.time-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'time-indicator';
            this.container.appendChild(indicator);
        }
        
        indicator.style.left = `${position}%`;
    }

    startTimeTracking() {
        setInterval(() => {
            this.updateTimeIndicator();
            this.updateProgramStates();
        }, 60000);
    }

    updateProgramStates() {
        const programs = this.container.querySelectorAll('.program');
        programs.forEach(program => {
            const start = new Date(program.dataset.start);
            const stop = new Date(program.dataset.stop);
            program.classList.toggle('live', this.isCurrentlyLive(start, stop));
        });
    }

    handleSearch() {
        const query = this.searchInput.value.toLowerCase();
        const rows = this.container.querySelectorAll('.row');
        
        rows.forEach(row => {
            const channelName = row.querySelector('.channelBoxName').textContent.toLowerCase();
            row.style.display = channelName.includes(query) ? 'flex' : 'none';
        });
    }

    filterChannels() {
        const rows = this.container.querySelectorAll('.row');
        
        rows.forEach(row => {
            if (this.currentFilter === 'all') {
                row.style.display = 'flex';
            } else {
                const category = row.dataset.category;
                row.style.display = category === this.currentFilter ? 'flex' : 'none';
            }
        });
    }

    showLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'flex';
            if (this.container) this.container.style.display = 'none';
            if (this.errorElement) this.errorElement.style.display = 'none';
        }
    }

    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
            if (this.container) this.container.style.display = 'block';
        }
    }

    showError(message) {
        if (this.errorElement) {
            const errorMessage = this.errorElement.querySelector('.error-message');
            if (errorMessage) errorMessage.textContent = message;
            this.errorElement.style.display = 'flex';
            if (this.loadingElement) this.loadingElement.style.display = 'none';
            if (this.container) this.container.style.display = 'none';
        }
    }

    createChannelBox(channel) {
        const channelBox = document.createElement('div');
        channelBox.className = 'channelBox';
        
        const channelContent = document.createElement('div');
        channelContent.className = 'channelBox-content';
        
        // Create logo wrapper
        const logoWrapper = document.createElement('div');
        logoWrapper.className = 'channel-logo-wrapper';
        
        if (channel.logo) {
            const logo = document.createElement('img');
            logo.className = 'channelBoxLogo';
            logo.src = channel.logo;
            logo.alt = `${channel.name} logo`;
            logo.loading = 'lazy';
            
            // Handle logo loading errors
            logo.onerror = () => {
                logoWrapper.innerHTML = ''; // Clear the broken image
                logoWrapper.classList.add('using-initials');
                const initials = this.getChannelInitials(channel.name);
                const initialsDiv = document.createElement('div');
                initialsDiv.className = 'channel-initials';
                initialsDiv.textContent = initials;
                logoWrapper.appendChild(initialsDiv);
            };
            
            logoWrapper.appendChild(logo);
        } else {
            // No logo provided, use initials
            logoWrapper.classList.add('using-initials');
            const initials = this.getChannelInitials(channel.name);
            const initialsDiv = document.createElement('div');
            initialsDiv.className = 'channel-initials';
            initialsDiv.textContent = initials;
            logoWrapper.appendChild(initialsDiv);
        }
        
        // Create channel name element
        const channelName = document.createElement('div');
        channelName.className = 'channelBoxName';
        channelName.textContent = channel.name;
        
        // Assemble the channel box
        channelContent.appendChild(logoWrapper);
        channelContent.appendChild(channelName);
        channelBox.appendChild(channelContent);
        
        return channelBox;
    }
}

// Initialize EPG when document is ready
document.addEventListener('DOMContentLoaded', () => {
    new EPGManager();
}); 