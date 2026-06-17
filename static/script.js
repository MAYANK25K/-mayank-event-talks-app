document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const searchInput = document.getElementById('search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const notesContainer = document.getElementById('notes-container');
    const loadingOverlay = document.getElementById('loading-overlay');
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

    // State variables
    let allUpdates = []; // Parsed individual release update items
    let selectedUpdate = null;
    let currentFilterType = 'all';

    // Fetch notes from the proxy API
    async function fetchReleaseNotes() {
        showLoading(true);
        showError(false);
        setEmptyState(false);
        clearSelection();

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
            renderUpdates();
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

                if (update.link) {
                    const link = document.createElement('a');
                    link.className = 'card-link';
                    link.href = update.link;
                    link.target = '_blank';
                    link.title = 'View official GCP release notes';
                    link.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
                    link.addEventListener('click', (e) => e.stopPropagation()); // prevent card selection trigger
                    meta.appendChild(link);
                }

                card.appendChild(meta);

                // Body content
                const desc = document.createElement('div');
                desc.className = 'card-desc';
                desc.innerHTML = update.contentHtml;
                card.appendChild(desc);

                // Click event to select card
                card.addEventListener('click', () => {
                    selectUpdate(update, card);
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

    // Overlay Loading state toggler
    function showLoading(isLoading) {
        if (isLoading) {
            loadingOverlay.classList.remove('hidden');
            refreshIcon.classList.add('spinning');
            refreshBtn.disabled = true;
        } else {
            loadingOverlay.classList.add('hidden');
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

    // Event Listeners
    refreshBtn.addEventListener('click', fetchReleaseNotes);
    retryBtn.addEventListener('click', fetchReleaseNotes);
    tweetBtn.addEventListener('click', shareToTwitter);

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
