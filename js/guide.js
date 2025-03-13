// EPG (Electronic Program Guide) functionality
class EPGManager {
    constructor() {
        this.epgUrl = 'https://raw.githubusercontent.com/SKYNETUCL/SKYNET2-DADDYS/refs/heads/main/SPORTSEPG';
        this.xmlDoc = null;
        this.channels = null;
        this.earliestStartDate = null;
        this.latestStopDate = null;
        this.timelineLength = null;
        this.timelineBlockDuration = 30;
        this.oneUnit = 5;
        this.timelineTimer = null;
        this.timezoneOffset = 12; // Fiji GMT+12
        this.container = document.getElementById('epg-container');
    }

    async init() {
        try {
            await this.loadXML();
            await this.getChannels();
            await this.getPrograms();
            await this.displayAllPrograms();
            this.timelineNeedleRender();
            this.startAutoRefresh();
        } catch (error) {
            console.error('Failed to initialize EPG:', error);
            this.showError('Failed to load program guide');
        }
    }

    async loadXML() {
        try {
            const response = await fetch(this.epgUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const text = await response.text();
            this.xmlDoc = new DOMParser().parseFromString(text, 'application/xml');
            
            if (this.xmlDoc.querySelector('parsererror')) {
                throw new Error('Failed to parse EPG XML data');
            }
        } catch (error) {
            console.error('Error loading XML:', error);
            throw error;
        }
    }

    async getChannels() {
        if (!this.xmlDoc) return;
        
        const channels = this.xmlDoc.querySelectorAll('channel');
        this.channels = Array.from(channels).map(channel => ({
            tvgId: channel.getAttribute('id'),
            channelName: channel.querySelector('display-name')?.textContent || 'Unknown',
            tvgLogo: channel.querySelector('icon')?.getAttribute('src') || null
        }));
    }

    parseDateTime(dateStr) {
        if (!dateStr) return null;
        
        try {
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            const hour = parseInt(dateStr.substring(8, 10));
            const minute = parseInt(dateStr.substring(10, 12));
            const second = parseInt(dateStr.substring(12, 14));
            
            const tzSign = dateStr.charAt(15);
            const tzHours = parseInt(dateStr.substring(16, 18));
            const tzMinutes = parseInt(dateStr.substring(18, 20));
            
            const utcDate = Date.UTC(year, month, day, hour, minute, second);
            const tzOffset = (tzHours * 60 + tzMinutes) * 60 * 1000;
            
            return new Date(utcDate + (tzSign === '+' ? -tzOffset : tzOffset));
        } catch (error) {
            console.error('Error parsing date:', dateStr, error);
            return null;
        }
    }

    toFijiTime(date) {
        if (!date) return null;
        const localOffset = date.getTimezoneOffset();
        const fijiOffset = (this.timezoneOffset * 60) + localOffset;
        return new Date(date.getTime() + (fijiOffset * 60 * 1000));
    }

    startAutoRefresh() {
        // Update EPG every minute
        setInterval(() => {
            this.getPrograms();
            this.displayAllPrograms();
            this.timelineNeedleRender();
        }, 60000);
    }

    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="epg-error">
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        ${message}
                    </div>
                </div>
            `;
        }
    }

    getDayAndTime(date) {
        // Match channel-epg.js implementation
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

    async getPrograms() {
        const programmes = this.xmlDoc.querySelectorAll('programme');
        if (!programmes.length) return;

        // Process all programs first
        const processedPrograms = Array.from(programmes).map(prog => {
            const start = this.parseDateTime(prog.getAttribute('start'));
            const stop = this.parseDateTime(prog.getAttribute('stop'));
            
            if (!start || !stop) return null;

            const fijiStart = this.toFijiTime(start);
            const fijiStop = this.toFijiTime(stop);

            return {
                programme: prog,
                start: fijiStart,
                stop: fijiStop,
                duration: this.getDurationInMinutes(fijiStart, fijiStop)
            };
        }).filter(item => item !== null);

        // Find earliest and latest dates from processed programs
        this.earliestStartDate = processedPrograms.reduce((earliest, current) => 
            !earliest || current.start < earliest ? current.start : earliest, null);
        
        this.latestStopDate = processedPrograms.reduce((latest, current) => 
            !latest || current.stop > latest ? current.stop : latest, null);

        this.timelineLength = this.getDurationInMinutes(this.earliestStartDate, this.latestStopDate);
    }

    getDurationInMinutes(date1, date2) {
        let differenceInMs = Math.abs(date2 - date1);
        let differenceInMinutes = Math.floor(differenceInMs / (1000 * 60));
        return differenceInMinutes;
    }

    formatTimeSlot(date) {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });
    }

    isCurrentlyLive(start, stop) {
        const fijiNow = this.toFijiTime(new Date());
        return fijiNow >= start && fijiNow < stop;
    }

    async displayAllPrograms() {
        if (!this.container) return;
        
        const fijiNow = this.toFijiTime(new Date());
        
        // Create header with timezone info
        const header = document.createElement('div');
        header.className = 'epg-header';
        header.innerHTML = `
            <h3><i class="fas fa-tv"></i> Program Guide</h3>
            <div class="timezone-info">Times shown in GMT+12 (Fiji)</div>
        `;
        
        // Create table structure
        const table = document.createElement('div');
        table.className = 'table';
        
        // Generate timeline header
        const thead = document.createElement('div');
        thead.className = 'thead';
        const headerRow = document.createElement('div');
        headerRow.className = 'row';
        
        // Add channel header
        const channelHeader = document.createElement('div');
        channelHeader.className = 'channelBox pinned-channel-box';
        channelHeader.innerHTML = '<div class="channelBoxName">Channel</div>';
        headerRow.appendChild(channelHeader);
        
        // Calculate timeline start (round to nearest 26/56 minutes)
        const minutes = fijiNow.getMinutes();
        let roundedMinutes;
        if (minutes < 26) {
            roundedMinutes = 26;
        } else if (minutes < 56) {
            roundedMinutes = 56;
        } else {
            roundedMinutes = 26;
            fijiNow.setHours(fijiNow.getHours() + 1);
        }
        
        const timelineStart = new Date(fijiNow);
        timelineStart.setMinutes(roundedMinutes);
        timelineStart.setSeconds(0);
        timelineStart.setMilliseconds(0);
        
        // Generate timeline slots
        const numOfBlocks = 14; // Show 14 time slots
        for (let i = 0; i < numOfBlocks; i++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'cell pinned-timeline';
            
            const slotTime = new Date(timelineStart);
            slotTime.setMinutes(timelineStart.getMinutes() + (i * 30));
            const dayTime = this.getDayAndTime(slotTime);
            
            timeSlot.innerHTML = `
                <div class="timelineDay">${dayTime.split(' ')[0]}</div>
                <div class="timelineTime">${dayTime.split(' ').slice(1).join(' ')}</div>
            `;
            timeSlot.style.width = `${this.oneUnit * this.timelineBlockDuration}px`;
            headerRow.appendChild(timeSlot);
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create tbody
        const tbody = document.createElement('div');
        tbody.className = 'tbody';

        // Add channel rows
        this.channels.forEach(channel => {
            const row = document.createElement('div');
            row.className = 'row';
            
            // Add channel column
            const channelCol = document.createElement('div');
            channelCol.className = 'channelBox pinned-channel-box';
            channelCol.innerHTML = `
                <div class="channelBoxName">
                    <img src="${channel.tvgLogo}" class="channelBoxImage" alt="${channel.channelName}">
                    <span>${channel.channelName}</span>
                </div>
            `;
            row.appendChild(channelCol);
            
            // Add programs container
            const programsContainer = document.createElement('div');
            programsContainer.className = 'programs-container';
            
            // Get and filter programs for this channel
            const programs = Array.from(this.xmlDoc.querySelectorAll(`programme[channel="${channel.tvgId}"]`))
                .map(prog => {
                    const start = this.parseDateTime(prog.getAttribute('start'));
                    const stop = this.parseDateTime(prog.getAttribute('stop'));
                    if (!start || !stop) return null;
                    
                    const fijiStart = this.toFijiTime(start);
                    const fijiStop = this.toFijiTime(stop);
                    
                    return {
                        programme: prog,
                        start: fijiStart,
                        stop: fijiStop,
                        width: this.getDurationInMinutes(fijiStart, fijiStop) * this.oneUnit,
                        isLive: fijiNow >= fijiStart && fijiNow < fijiStop
                    };
                })
                .filter(item => item !== null && item.stop > fijiNow)
                .sort((a, b) => a.start - b.start);

            // Calculate timeline start time (round down to nearest 30 minutes)
            const timelineStart = new Date(fijiNow);
            timelineStart.setMinutes(Math.floor(timelineStart.getMinutes() / 30) * 30);
            timelineStart.setSeconds(0);
            timelineStart.setMilliseconds(0);

            // Position programs relative to timeline start
            programs.forEach((program, index) => {
                if (program.isLive) {
                    // Live programs start immediately after channel logo (200px)
                    program.position = 200;
                } else {
                    // For upcoming programs
                    const prevProgram = programs[index - 1];
                    if (prevProgram) {
                        // Position immediately after previous program
                        program.position = prevProgram.position + prevProgram.width;
                    } else {
                        // First program (when no live program)
                        const minutesToStart = this.getDurationInMinutes(fijiNow, program.start);
                        // Start from channel logo width (200px)
                        program.position = 200 + (minutesToStart * this.oneUnit);
                    }
                }
            });

            // Add programs with transition effect
            programs.forEach(({ programme, start, stop, width, position, isLive }) => {
                const program = document.createElement('div');
                program.className = `program ${isLive ? 'now' : ''}`;
                program.style.width = `${width}px`;
                program.style.left = `${position}px`;
                program.style.position = 'absolute';
                program.style.transition = 'left 0.5s ease';
                
                // Add small margin only between programs, not for the first one
                if (!isLive && position > 200) {
                    program.style.marginLeft = '2px';
                }
                
                program.innerHTML = `
                    <div class="program-title">${programme.querySelector('title')?.textContent || 'Unknown'}</div>
                    <div class="program-time">${this.formatTimeSlot(start)} - ${this.formatTimeSlot(stop)}</div>
                `;
                programsContainer.appendChild(program);
            });

            row.appendChild(programsContainer);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        this.container.innerHTML = '';
        this.container.appendChild(header);
        this.container.appendChild(table);
        
        // Add current time indicator
        this.timelineNeedleRender();
    }

    timelineNeedleRender() {
        const redLine = document.createElement('div');
        redLine.id = 'vertical-red-line';
        document.getElementById('epg-container').appendChild(redLine);
        
        const updateNeedle = () => {
            const fijiNow = this.toFijiTime(new Date());
            const offset = 200 + (this.getDurationInMinutes(this.earliestStartDate, fijiNow) * this.oneUnit);
            redLine.style.left = `${offset}px`;
        };

        updateNeedle();
        this.timelineTimer = setInterval(updateNeedle, 60000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const epgManager = new EPGManager();
    epgManager.init().catch(error => {
        console.error('Failed to initialize EPG:', error);
    });
}); 