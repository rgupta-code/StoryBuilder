// StoryBuilder - Interactive Story Creation Tool
class StoryBuilder {
    constructor() {
        this.currentStory = null;
        this.currentPage = 0;
        this.currentView = 'single';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadStoredApiKey();
    }

    bindEvents() {
        // Form submission
        document.getElementById('create-story-btn').addEventListener('click', () => {
            this.createStory();
        });

        // View controls
        document.getElementById('single-page-view').addEventListener('click', () => {
            this.switchView('single');
        });

        document.getElementById('book-view').addEventListener('click', () => {
            this.switchView('book');
        });

        // Navigation controls
        document.getElementById('prev-page').addEventListener('click', () => {
            this.previousPage();
        });

        document.getElementById('next-page').addEventListener('click', () => {
            this.nextPage();
        });

        document.getElementById('book-prev').addEventListener('click', () => {
            this.previousPage();
        });

        document.getElementById('book-next').addEventListener('click', () => {
            this.nextPage();
        });

        // Back to form
        document.getElementById('back-to-form').addEventListener('click', () => {
            this.showForm();
        });

        // Download story
        document.getElementById('download-story').addEventListener('click', () => {
            this.downloadStory();
        });

        // API key storage
        document.getElementById('api-key').addEventListener('input', (e) => {
            localStorage.setItem('gemini-api-key', e.target.value);
        });
    }

    loadStoredApiKey() {
        const storedKey = localStorage.getItem('gemini-api-key');
        if (storedKey) {
            document.getElementById('api-key').value = storedKey;
        }
    }

    async createStory() {
        const formData = this.getFormData();
        
        if (!this.validateForm(formData)) {
            return;
        }

        this.showLoading();
        
        try {
            const story = await this.generateStoryWithGemini(formData);
            this.currentStory = story;
            this.currentPage = 0;
            this.displayStory();
        } catch (error) {
            this.showError(error.message);
        }
    }

    getFormData() {
        return {
            topic: document.getElementById('story-topic').value.trim(),
            genre: document.getElementById('genre').value,
            tone: document.getElementById('tone').value,
            ageGroup: document.getElementById('age-group').value,
            length: document.getElementById('story-length').value,
            apiKey: document.getElementById('api-key').value.trim()
        };
    }

    validateForm(data) {
        if (!data.topic) {
            this.showError('Please tell us what your story is about!');
            return false;
        }

        if (!data.apiKey) {
            this.showError('Please enter your Gemini API key to create stories.');
            return false;
        }

        return true;
    }

    async generateStoryWithGemini(formData) {
        const prompt = this.buildPrompt(formData);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${formData.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'Failed to generate story';
            
            // Check for specific API errors
            if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
                throw new Error('API rate limit reached. Please try again in a minute.');
            } else if (errorMessage.includes('invalid API key')) {
                throw new Error('Invalid API key. Please check your Gemini API key.');
            } else {
                throw new Error(`API Error: ${errorMessage}`);
            }
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('No story content received from API. Please try again.');
        }
        
        const storyText = data.candidates[0].content.parts[0].text;
        const story = this.parseStoryIntoPages(storyText, formData);
        
        return story;
    }

    buildPrompt(formData) {
        const ageDescriptions = {
            '3-5': 'very simple language with short sentences, lots of repetition, and basic vocabulary',
            '6-8': 'simple language with clear sentences, some descriptive words, and engaging dialogue',
            '9-12': 'more complex language with varied vocabulary, detailed descriptions, and character development'
        };

        const lengthDescriptions = {
            'short': '2-3 pages (keep each page short)',
            'medium': '4-6 pages (moderate length per page)', 
            'long': '7-10 pages (detailed content per page)'
        };

        return `You are a creative children's storyteller. Create a ${formData.genre} story with a ${formData.tone} tone for children aged ${formData.ageGroup} years.

Story topic: ${formData.topic}

Requirements:
- Use ${ageDescriptions[formData.ageGroup]}
- Make it ${formData.tone} in tone
- Write exactly ${lengthDescriptions[formData.length]} of story content
- Use natural, conversational language - avoid robotic or formal writing
- Include dialogue and character interactions
- Make it engaging and fun for kids
- Each page should be a natural story segment (paragraph or two)
- Start with a title page

Format the response as:
TITLE: [Story Title]

PAGE 1: [Content for page 1]

PAGE 2: [Content for page 2]

[Continue for all pages...]

Make the story magical, engaging, and perfect for children! Keep it concise and well-structured.`;
    }

    parseStoryIntoPages(storyText, formData) {
        const lines = storyText.split('\n').filter(line => line.trim());
        const pages = [];
        let currentPage = { title: '', content: '' };
        let pageNumber = 0;

        for (const line of lines) {
            if (line.startsWith('TITLE:')) {
                currentPage.title = line.replace('TITLE:', '').trim();
            } else if (line.startsWith('PAGE')) {
                if (currentPage.content) {
                    pages.push({ ...currentPage, pageNumber: pageNumber++ });
                }
                currentPage = { title: '', content: '' };
            } else if (line.trim()) {
                currentPage.content += (currentPage.content ? '\n\n' : '') + line.trim();
            }
        }

        // Add the last page
        if (currentPage.content) {
            pages.push({ ...currentPage, pageNumber: pageNumber++ });
        }

        // If no pages were created, split the text into paragraphs
        if (pages.length === 0) {
            const paragraphs = storyText.split('\n\n').filter(p => p.trim());
            const title = paragraphs[0] || 'My Amazing Story';
            const content = paragraphs.slice(1);
            
            content.forEach((para, index) => {
                pages.push({
                    title: index === 0 ? title : `Page ${index + 1}`,
                    content: para.trim(),
                    pageNumber: index
                });
            });
        }

        // Add "The End" to the last page
        if (pages.length > 0) {
            const lastPage = pages[pages.length - 1];
            lastPage.content += '\n\n**The End**';
        }

        return {
            title: pages[0]?.title || 'My Amazing Story',
            pages: pages,
            metadata: formData
        };
    }

    displayStory() {
        this.hideLoading();
        this.showStoryDisplay();
        this.updatePageDisplay();
    }

    showLoading() {
        document.getElementById('story-form').classList.add('hidden');
        document.getElementById('story-display').classList.add('hidden');
        document.getElementById('loading-state').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-state').classList.add('hidden');
    }

    showStoryDisplay() {
        document.getElementById('story-display').classList.remove('hidden');
    }

    showForm() {
        document.getElementById('story-display').classList.add('hidden');
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('story-form').classList.remove('hidden');
    }

    switchView(view) {
        this.currentView = view;
        
        // Update button states
        document.getElementById('single-page-view').classList.toggle('active', view === 'single');
        document.getElementById('book-view').classList.toggle('active', view === 'book');
        
        // Show/hide containers
        document.getElementById('single-page-container').classList.toggle('hidden', view !== 'single');
        document.getElementById('book-container').classList.toggle('hidden', view !== 'book');
        
        this.updatePageDisplay();
    }

    updatePageDisplay() {
        if (!this.currentStory || !this.currentStory.pages.length) return;

        const currentPageData = this.currentStory.pages[this.currentPage];
        
        if (this.currentView === 'single') {
            this.updateSinglePageView(currentPageData);
        } else {
            this.updateBookView();
        }
        
        this.updateNavigation();
    }

    updateSinglePageView(pageData) {
        const content = document.getElementById('single-page-content');
        const formattedContent = this.formatStoryContent(pageData.content);
        const isFirstPage = this.currentPage === 0;
        
        content.innerHTML = `
            ${isFirstPage ? `<h2 class="main-story-title">${this.currentStory.title}</h2>` : ''}
            <h3 class="story-title">${pageData.title}</h3>
            <div class="story-text">${formattedContent}</div>
            ${pageData.image ? `
                <div class="story-image">
                    <img src="${pageData.image}" alt="Story illustration">
                    <div class="image-controls">
                        <button class="remove-image-btn" onclick="storyBuilder.removeImage(${this.currentPage})">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                        <button class="upload-image-btn" onclick="storyBuilder.uploadCustomImage(${this.currentPage})">
                            <i class="fas fa-upload"></i> Upload Custom
                        </button>
                    </div>
                </div>
            ` : `
                <div class="story-image">
                    <button class="upload-image-btn" onclick="storyBuilder.uploadCustomImage(${this.currentPage})">
                        <i class="fas fa-plus"></i> Add Image
                    </button>
                </div>
            `}
        `;
        
        document.getElementById('page-indicator').textContent = 
            `Page ${this.currentPage + 1} of ${this.currentStory.pages.length}`;
    }

    updateBookView() {
        const bookPages = document.getElementById('book-pages');
        bookPages.innerHTML = '';
        
        // Calculate which pages to show (2 pages per spread)
        const pagesPerSpread = 2;
        const currentSpread = Math.floor(this.currentPage / pagesPerSpread);
        const startPage = currentSpread * pagesPerSpread;
        
        // Create book spread container
        const spreadElement = document.createElement('div');
        spreadElement.className = 'book-spread';
        
        // Left page
        const leftPage = document.createElement('div');
        leftPage.className = 'book-page-left';
        
        if (startPage < this.currentStory.pages.length) {
            const leftPageData = this.currentStory.pages[startPage];
            const isFirstPage = startPage === 0;
            
            const leftFormattedContent = this.formatStoryContent(leftPageData.content);
            const isLeftFirstPage = startPage === 0;
            leftPage.innerHTML = `
                <div class="page-turn-indicator prev ${isFirstPage ? 'disabled' : ''}">
                    <i class="fas fa-chevron-left"></i>
                </div>
                ${isLeftFirstPage ? `<h2 class="main-story-title">${this.currentStory.title}</h2>` : ''}
                <h3 class="story-title">${leftPageData.title}</h3>
                <div class="story-text">${leftFormattedContent}</div>
                ${leftPageData.image ? `
                    <div class="story-image">
                        <img src="${leftPageData.image}" alt="Story illustration">
                        <div class="image-controls">
                            <button class="remove-image-btn" onclick="storyBuilder.removeImage(${startPage})">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="upload-image-btn" onclick="storyBuilder.uploadCustomImage(${startPage})">
                                <i class="fas fa-upload"></i>
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="story-image">
                        <button class="upload-image-btn" onclick="storyBuilder.uploadCustomImage(${startPage})">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                `}
            `;
            
            // Add event listener for previous spread (only if not first page)
            if (!isFirstPage) {
                const prevIndicator = leftPage.querySelector('.page-turn-indicator.prev');
                prevIndicator.addEventListener('click', () => this.previousSpread());
            }
        } else {
            leftPage.innerHTML = '<div class="empty-page"></div>';
        }
        
        // Right page
        const rightPage = document.createElement('div');
        rightPage.className = 'book-page-right';
        
        if (startPage + 1 < this.currentStory.pages.length) {
            const rightPageData = this.currentStory.pages[startPage + 1];
            const isLastPage = startPage + 1 === this.currentStory.pages.length - 1;
            
            const rightFormattedContent = this.formatStoryContent(rightPageData.content);
            const isRightFirstPage = startPage + 1 === 0;
            rightPage.innerHTML = `
                <div class="page-turn-indicator next ${isLastPage ? 'disabled' : ''}">
                    <i class="fas fa-chevron-right"></i>
                </div>
                ${isRightFirstPage ? `<h2 class="main-story-title">${this.currentStory.title}</h2>` : ''}
                <h3 class="story-title">${rightPageData.title}</h3>
                <div class="story-text">${rightFormattedContent}</div>
                ${rightPageData.image ? `
                    <div class="story-image">
                        <img src="${rightPageData.image}" alt="Story illustration">
                        <div class="image-controls">
                            <button class="remove-image-btn" onclick="storyBuilder.removeImage(${startPage + 1})">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="upload-image-btn" onclick="storyBuilder.uploadCustomImage(${startPage + 1})">
                                <i class="fas fa-upload"></i>
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="story-image">
                        <button class="upload-image-btn" onclick="storyBuilder.uploadCustomImage(${startPage + 1})">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                `}
            `;
            
            // Add event listener for next spread (only if not last page)
            if (!isLastPage) {
                const nextIndicator = rightPage.querySelector('.page-turn-indicator.next');
                nextIndicator.addEventListener('click', () => this.nextSpread());
            }
        } else {
            rightPage.innerHTML = '<div class="empty-page"></div>';
        }
        
        spreadElement.appendChild(leftPage);
        spreadElement.appendChild(rightPage);
        bookPages.appendChild(spreadElement);
        
        // Update page indicator to show current spread
        const totalSpreads = Math.ceil(this.currentStory.pages.length / pagesPerSpread);
        const currentSpreadNumber = currentSpread + 1;
        document.getElementById('book-page-indicator').textContent = `${currentSpreadNumber} / ${totalSpreads}`;
    }

    updateNavigation() {
        const totalPages = this.currentStory.pages.length;
        const isFirstPage = this.currentPage === 0;
        const isLastPage = this.currentPage === totalPages - 1;
        
        // Update single page navigation
        document.getElementById('prev-page').disabled = isFirstPage;
        document.getElementById('next-page').disabled = isLastPage;
        
        // Update book navigation
        document.getElementById('book-prev').disabled = isFirstPage;
        document.getElementById('book-next').disabled = isLastPage;
    }

    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.updatePageDisplay();
        }
    }

    nextPage() {
        if (this.currentPage < this.currentStory.pages.length - 1) {
            this.currentPage++;
            this.updatePageDisplay();
        }
    }

    // Navigate by spreads (for book view)
    previousSpread() {
        const pagesPerSpread = 2;
        const currentSpread = Math.floor(this.currentPage / pagesPerSpread);
        if (currentSpread > 0) {
            this.animatePageFlip(() => {
                this.currentPage = (currentSpread - 1) * pagesPerSpread;
                this.updatePageDisplay();
            });
        }
    }

    nextSpread() {
        const pagesPerSpread = 2;
        const currentSpread = Math.floor(this.currentPage / pagesPerSpread);
        const totalSpreads = Math.ceil(this.currentStory.pages.length / pagesPerSpread);
        if (currentSpread < totalSpreads - 1) {
            this.animatePageFlip(() => {
                this.currentPage = (currentSpread + 1) * pagesPerSpread;
                this.updatePageDisplay();
            });
        }
    }

    animatePageFlip(callback) {
        const bookSpread = document.querySelector('.book-spread');
        if (bookSpread) {
            bookSpread.classList.add('flipping');
            setTimeout(() => {
                callback();
                setTimeout(() => {
                    bookSpread.classList.remove('flipping');
                }, 50);
            }, 300);
        } else {
            callback();
        }
    }







    formatStoryContent(content) {
        // Convert markdown-style formatting to HTML
        let formattedContent = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
            .replace(/\n\n/g, '</p><p>') // Paragraphs
            .replace(/^/, '<p>') // Start first paragraph
            .replace(/$/, '</p>'); // End last paragraph
        
        return formattedContent;
    }

    removeImage(pageIndex) {
        if (this.currentStory && this.currentStory.pages[pageIndex]) {
            this.currentStory.pages[pageIndex].image = null;
            this.updatePageDisplay();
        }
    }

    uploadCustomImage(pageIndex) {
        // Create a hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (this.currentStory && this.currentStory.pages[pageIndex]) {
                        this.currentStory.pages[pageIndex].image = e.target.result;
                        this.updatePageDisplay();
                    }
                };
                reader.readAsDataURL(file);
            }
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }



    downloadStory() {
        if (!this.currentStory) return;

        const storyText = this.formatStoryForDownload();
        const blob = new Blob([storyText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentStory.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    formatStoryForDownload() {
        let text = `${this.currentStory.title}\n`;
        text += '='.repeat(this.currentStory.title.length) + '\n\n';
        
        this.currentStory.pages.forEach((page, index) => {
            text += `Page ${index + 1}: ${page.title}\n`;
            text += '-'.repeat(page.title.length + 8) + '\n';
            text += page.content + '\n\n';
        });
        
        text += `\nStory created with StoryBuilder\n`;
        text += `Genre: ${this.currentStory.metadata.genre}\n`;
        text += `Tone: ${this.currentStory.metadata.tone}\n`;
        text += `Age Group: ${this.currentStory.metadata.ageGroup}\n`;
        
        return text;
    }

    showError(message) {
        this.hideLoading();
        
        // Create error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        
        notification.querySelector('.error-content').style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;
        
        notification.querySelector('button').style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 1.2rem;
            cursor: pointer;
            margin-left: auto;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize the application when the page loads
let storyBuilder;
document.addEventListener('DOMContentLoaded', () => {
    storyBuilder = new StoryBuilder();
});

// Add some fun interactive elements
document.addEventListener('DOMContentLoaded', () => {
    // Add hover effects to form elements
    const formElements = document.querySelectorAll('input, textarea, select');
    formElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'translateY(-2px)';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = 'translateY(0)';
        });
    });

    // Add click sound effect (optional)
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            // Add a subtle scale effect
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 150);
        });
    });
}); 