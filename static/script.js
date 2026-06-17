document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const searchInput = document.getElementById('search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const notesContainer = document.getElementById('notes-container');
    const skeletonContainer = document.getElementById('skeleton-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');
    const emptyState = document.getElementById('empty-state');
    
    // Selection panel DOM elements
    const selectionCard = document.getElementById('selection-card');
    const selectionPlaceholder = document.getElementById('selection-placeholder');
    const selectionContent = document.getElementById('selection-content');
    const selectedBadgeType = document.getElementById('selected-badge-type');
    const selectedDate = document.getElementById('selected-date');
    const selectedTextPreview = document.getElementById('selected-text-preview');
    const tweetBtn = document.getElementById('tweet-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    // State variables
    let allUpdates = []; // Parsed individual release update items
    let selectedUpdate = null;
    let currentFilterType = 'all';
    let lastVisitTime = null;

    // Theme Switcher Logic
    const checkboxTheme = document.getElementById('checkbox-theme');
    
    // Load preference or default to dark theme
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    if (currentTheme === 'light') {
        checkboxTheme.checked = true;
    }
    
    checkboxTheme.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    });

    // Fetch notes from the proxy API
    async function fetchReleaseNotes() {
        showLoading(true);
        showError(false);
        setEmptyState(false);
        clearSelection();

        // Load the last visit time and save the current session visit time
        lastVisitTime = localStorage.getItem('last_visit_time');
        const nowIso = new Date().toISOString();

        try {
            const response = await fetch('/api/notes');
            if (!response.ok) {
                throw new Error(`Server returned status ${response.status}`);
            }
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch release notes.');
            }
            
            // Parse entries into discrete update cards
            allUpdates = parseFeedEntries(data.entries);
            updateFilterCounts();
            renderUpdates();

            // Save the visit time for the next session
            localStorage.setItem('last_visit_time', nowIso);
        } catch (error) {
            console.error('Error fetching release notes:', error);
            errorMessage.textContent = error.message;
            showError(true);
        } finally {
            showLoading(false);
        }
    }

    // Helper: Parse entry HTML contents and split multiple updates
    function parseFeedEntries(entries) {
        const parsedUpdates = [];
        const parser = new DOMParser();

        entries.forEach(entry => {
            const dateStr = entry.title; // e.g. "June 15, 2026"
            const updatedTime = entry.updated;
            const entryLink = entry.link;
            
            const doc = parser.parseFromString(entry.content, 'text/html');
            const bodyChildren = Array.from(doc.body.children);
            
            let currentType = 'Announcement'; // Default fallback
            let currentContentHtml = '';
            let currentPlainText = '';
            
            bodyChildren.forEach((child, index) => {
                const isHeading = child.tagName.toLowerCase() === 'h3';
                
                if (isHeading) {
                    // If we already accumulated content for a previous item, save it
                    if (currentContentHtml.trim() !== '') {
                        parsedUpdates.push({
                            date: dateStr,
                            updatedTime: updatedTime,
                            type: currentType,
                            contentHtml: currentContentHtml,
                            plainText: currentPlainText.trim(),
                            link: entryLink
                        });
                    }
                    
                    // Start a new item
                    currentType = child.textContent.trim();
                    currentContentHtml = '';
                    currentPlainText = '';
                } else {
                    // Accumulate content for the current item
                    currentContentHtml += child.outerHTML;
                    currentPlainText += child.textContent + ' ';
                }
                
                // If it's the last child, save the remaining accumulated content
                if (index === bodyChildren.length - 1 && currentContentHtml.trim() !== '') {
                    parsedUpdates.push({
                        date: dateStr,
                        updatedTime: updatedTime,
                        type: currentType,
                        contentHtml: currentContentHtml,
                        plainText: currentPlainText.trim(),
                        link: entryLink
                    });
                }
            });
            
            // Fallback if content was parsed as empty or had no elements
            if (bodyChildren.length === 0 && entry.content.trim() !== '') {
                parsedUpdates.push({
                    date: dateStr,
                    updatedTime: updatedTime,
                    type: 'Announcement',
                    contentHtml: entry.content,
                    plainText: doc.body.textContent.trim(),
                    link: entryLink
                });
            }
        });

        return parsedUpdates;
    }

    // Render updates to the container based on filters & search
    function renderUpdates() {
        notesContainer.innerHTML = '';
        const searchQuery = searchInput.value.toLowerCase().trim();
        
        // Filter list
        const filtered = allUpdates.filter(update => {
            // Type Filter
            const matchesType = currentFilterType === 'all' || 
                                update.type.toLowerCase() === currentFilterType;
            
            // Search Query Filter
            const matchesSearch = searchQuery === '' || 
                                  update.plainText.toLowerCase().includes(searchQuery) ||
                                  update.date.toLowerCase().includes(searchQuery) ||
                                  update.type.toLowerCase().includes(searchQuery);
            
            return matchesType && matchesSearch;
        });

        if (filtered.length === 0) {
            setEmptyState(true);
            return;
        }

        setEmptyState(false);

        // Group by Date to display neatly
        const grouped = {};
        filtered.forEach(update => {
            if (!grouped[update.date]) {
                grouped[update.date] = [];
            }
            grouped[update.date].push(update);
        });

        // Generate DOM for grouped cards
        for (const [date, updates] of Object.entries(grouped)) {
            const dayGroup = document.createElement('div');
            dayGroup.className = 'day-group';
            
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.textContent = date;
            dayGroup.appendChild(divider);

            updates.forEach(update => {
                const card = document.createElement('div');
                card.className = 'update-card';
                if (selectedUpdate && 
                    selectedUpdate.date === update.date && 
                    selectedUpdate.plainText === update.plainText) {
                    card.classList.add('selected');
                }

                // Header metadata
                const meta = document.createElement('div');
                meta.className = 'card-meta';
                
                const badge = document.createElement('span');
                badge.className = `badge badge-${update.type.toLowerCase()}`;
                badge.textContent = update.type;
                meta.appendChild(badge);

                // Check if it's a new update since last visit
                if (lastVisitTime && update.updatedTime) {
                    const updateDate = new Date(update.updatedTime);
                    const lastVisitDate = new Date(lastVisitTime);
                    if (updateDate > lastVisitDate) {
                        const newDot = document.createElement('span');
                        newDot.className = 'new-dot';
                        newDot.title = 'New update since your last visit';
                        meta.appendChild(newDot);
                    }
                }

                // Action controls container (Copy, Link)
                const actionsDiv = document.createElement('div');
                actionsDiv.style.display = 'flex';
                actionsDiv.style.gap = '0.4rem';
                actionsDiv.style.alignItems = 'center';

                // Copy to Clipboard Button
                const copyBtn = document.createElement('button');
                copyBtn.className = 'card-action-btn';
                copyBtn.title = 'Copy update text to clipboard';
                copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
                copyBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        await navigator.clipboard.writeText(update.plainText);
                        // Swap to success checkmark
                        copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: var(--color-feature);"></i>';
                        showToast("Copied to clipboard!");
                        setTimeout(() => {
                            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                    }
                });
                actionsDiv.appendChild(copyBtn);

                if (update.link) {
                    const link = document.createElement('a');
                    link.className = 'card-link';
                    link.href = update.link;
                    link.target = '_blank';
                    link.title = 'View official GCP release notes';
                    link.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
                    link.addEventListener('click', (e) => e.stopPropagation()); // prevent card selection trigger
                    actionsDiv.appendChild(link);
                }

                meta.appendChild(actionsDiv);
                card.appendChild(meta);

                // Body content
                const desc = document.createElement('div');
                desc.className = 'card-desc';
                desc.innerHTML = update.contentHtml;
                card.appendChild(desc);

                // Click and Keyboard events to select card
                card.setAttribute('tabindex', '0');
                card.addEventListener('click', () => {
                    selectUpdate(update, card);
                });
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectUpdate(update, card);
                    }
                });

                dayGroup.appendChild(card);
            });

            notesContainer.appendChild(dayGroup);
        }
    }

    // Select a release note update card
    function selectUpdate(update, cardElement) {
        // Deselect previous
        const selectedCards = document.querySelectorAll('.update-card.selected');
        selectedCards.forEach(c => c.classList.remove('selected'));

        if (selectedUpdate && 
            selectedUpdate.date === update.date && 
            selectedUpdate.plainText === update.plainText) {
            // Clicked already selected card: toggle off
            clearSelection();
        } else {
            // Select new
            selectedUpdate = update;
            cardElement.classList.add('selected');
            
            // Populate details sidebar
            selectionPlaceholder.classList.add('hidden');
            selectionContent.classList.remove('hidden');
            selectionCard.classList.add('has-selection');
            
            selectedBadgeType.className = `selected-badge badge-${update.type.toLowerCase()}`;
            selectedBadgeType.textContent = update.type;
            selectedDate.textContent = update.date;
            selectedTextPreview.textContent = update.plainText;
            
            tweetBtn.disabled = false;
        }
    }

    // Clear active selection
    function clearSelection() {
        selectedUpdate = null;
        selectionPlaceholder.classList.remove('hidden');
        selectionContent.classList.add('hidden');
        selectionCard.classList.remove('has-selection');
        tweetBtn.disabled = true;

        const selectedCards = document.querySelectorAll('.update-card.selected');
        selectedCards.forEach(c => c.classList.remove('selected'));
    }

    // Trigger Twitter Web Intent for the selected update
    function shareToTwitter() {
        if (!selectedUpdate) return;

        const date = selectedUpdate.date;
        const type = selectedUpdate.type;
        const text = selectedUpdate.plainText;
        const link = selectedUpdate.link || 'https://cloud.google.com/bigquery/docs/release-notes';

        // Format tweet body
        // Prefix with [BigQuery Announcement/Feature]
        const prefix = `BigQuery ${type} (${date}): `;
        const suffix = `\n\n#GoogleCloud #BigQuery`;
        
        // Calculate maximum available characters for description
        // Twitter limit is 280 characters.
        // Link takes up 23 characters inside Twitter's shortener.
        const linkLength = 23;
        const reservedLength = prefix.length + linkLength + suffix.length + 4; // 4 extra spacing chars
        const maxTextLength = 280 - reservedLength;

        let description = text;
        if (description.length > maxTextLength) {
            description = description.substring(0, maxTextLength - 3) + '...';
        }

        const tweetText = `${prefix}${description}${suffix}`;
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(link)}`;

        window.open(tweetUrl, '_blank', 'width=550,height=420');
    }

    // Pulse Skeleton state toggler
    function showLoading(isLoading) {
        if (isLoading) {
            skeletonContainer.classList.remove('hidden');
            notesContainer.classList.add('hidden');
            refreshIcon.classList.add('spinning');
            refreshBtn.disabled = true;
        } else {
            skeletonContainer.classList.add('hidden');
            notesContainer.classList.remove('hidden');
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }

    // Error container toggler
    function showError(isError) {
        if (isError) {
            errorContainer.classList.remove('hidden');
            notesContainer.classList.add('hidden');
        } else {
            errorContainer.classList.add('hidden');
            notesContainer.classList.remove('hidden');
        }
    }

    // Empty state container toggler
    function setEmptyState(isEmpty) {
        if (isEmpty) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    }

    // Export currently filtered list to CSV and trigger download
    function exportToCSV() {
        const searchQuery = searchInput.value.toLowerCase().trim();
        const filtered = allUpdates.filter(update => {
            const matchesType = currentFilterType === 'all' || 
                                update.type.toLowerCase() === currentFilterType;
            const matchesSearch = searchQuery === '' || 
                                  update.plainText.toLowerCase().includes(searchQuery) ||
                                  update.date.toLowerCase().includes(searchQuery) ||
                                  update.type.toLowerCase().includes(searchQuery);
            return matchesType && matchesSearch;
        });

        if (filtered.length === 0) {
            showToast("No notes available to export.");
            return;
        }

        // CSV Header
        const headers = ["Date", "Type", "Description", "Link"];
        
        // Escape helper for CSV cells
        const escapeCSV = (text) => {
            if (!text) return '""';
            const formatted = text.replace(/"/g, '""');
            return `"${formatted}"`;
        };

        const rows = filtered.map(update => [
            escapeCSV(update.date),
            escapeCSV(update.type),
            escapeCSV(update.plainText),
            escapeCSV(update.link)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Create Blob and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        const timestamp = new Date().toISOString().split('T')[0];
        const typeFilterName = currentFilterType !== 'all' ? `_${currentFilterType}` : '';
        link.setAttribute('download', `bigquery_release_notes${typeFilterName}_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast("CSV exported successfully!");
    }

    // Helper: Toast notifications popups
    function showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--color-feature);"></i> <span>${message}</span>`;
        container.appendChild(toast);
        
        // Triggers fade & slide in
        setTimeout(() => toast.classList.add('show'), 50);
        
        // Auto fadeout after 3s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // Helper: Calculate count badges for each category button
    function updateFilterCounts() {
        const counts = { all: allUpdates.length, feature: 0, announcement: 0, change: 0, issue: 0, breaking: 0 };
        allUpdates.forEach(update => {
            const type = update.type.toLowerCase();
            if (counts[type] !== undefined) {
                counts[type]++;
            }
        });
        
        for (const [key, val] of Object.entries(counts)) {
            const element = document.getElementById(`count-${key}`);
            if (element) {
                element.textContent = `(${val})`;
            }
        }
    }

    // Event Listeners
    refreshBtn.addEventListener('click', fetchReleaseNotes);
    retryBtn.addEventListener('click', fetchReleaseNotes);
    tweetBtn.addEventListener('click', shareToTwitter);
    exportCsvBtn.addEventListener('click', exportToCSV);

    // Live search input filtering
    searchInput.addEventListener('input', () => {
        renderUpdates();
    });

    // Category button filter selection
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilterType = btn.getAttribute('data-type');
            renderUpdates();
        });
    });

    // Initial Fetch
    fetchReleaseNotes();
});
