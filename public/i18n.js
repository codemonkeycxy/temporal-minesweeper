class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.supportedLanguages = ['en', 'es', 'fr', 'de', 'zh'];
        this.fallbackLanguage = 'en';
    }

    // Detect the user's preferred language from browser settings
    detectLanguage() {
        // Get browser languages in order of preference
        const browserLanguages = navigator.languages || [navigator.language || navigator.userLanguage];
        
        for (const lang of browserLanguages) {
            // Extract the language code (e.g., 'en-US' -> 'en')
            const langCode = lang.split('-')[0].toLowerCase();
            
            // Check if we support this language
            if (this.supportedLanguages.includes(langCode)) {
                return langCode;
            }
        }
        
        return this.fallbackLanguage;
    }

    // Load translation file for a specific language
    async loadTranslations(language) {
        try {
            const response = await fetch(`/locales/${language}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${language} translations`);
            }
            this.translations = await response.json();
            this.currentLanguage = language;
            
            // Update HTML lang attribute
            document.documentElement.lang = language;
            
            console.log(`Loaded translations for language: ${language}`);
            return true;
        } catch (error) {
            console.warn(`Failed to load translations for ${language}:`, error);
            
            // If it's not the fallback language, try loading fallback
            if (language !== this.fallbackLanguage) {
                console.log(`Falling back to ${this.fallbackLanguage}`);
                return this.loadTranslations(this.fallbackLanguage);
            }
            
            return false;
        }
    }

    // Initialize i18n with auto-detected language
    async init() {
        const detectedLanguage = this.detectLanguage();
        console.log(`Detected language: ${detectedLanguage}`);
        
        const success = await this.loadTranslations(detectedLanguage);
        if (success) {
            this.updatePageContent();
        }
        
        return success;
    }

    // Get translation for a key (supports nested keys like 'app.title')
    t(key, defaultValue = '') {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Return the key itself if translation not found, or default value
                return defaultValue || key;
            }
        }
        
        return value || defaultValue || key;
    }

    // Update all elements with data-i18n attributes
    updatePageContent() {
        // Update elements with data-i18n attribute for text content
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation && translation !== key) {
                // Special handling for option elements
                if (element.tagName.toLowerCase() === 'option') {
                    element.textContent = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });

        // Update elements with data-i18n-placeholder attribute for placeholder text
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        });

        // Update elements with data-i18n-title attribute for title text
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.title = translation;
            }
        });

        // Update page title
        const titleKey = document.querySelector('title')?.getAttribute('data-i18n');
        if (titleKey) {
            document.title = this.t(titleKey);
        }

        // Trigger custom event for any additional updates
        window.dispatchEvent(new CustomEvent('i18n-updated', { 
            detail: { language: this.currentLanguage } 
        }));
    }

    // Change language manually
    async changeLanguage(language) {
        if (!this.supportedLanguages.includes(language)) {
            console.warn(`Language ${language} is not supported`);
            return false;
        }

        const success = await this.loadTranslations(language);
        if (success) {
            this.updatePageContent();
            
            // Save language preference to localStorage
            try {
                localStorage.setItem('preferred-language', language);
            } catch (error) {
                console.warn('Failed to save language preference:', error);
            }
        }
        
        return success;
    }

    // Get saved language preference
    getSavedLanguage() {
        try {
            return localStorage.getItem('preferred-language');
        } catch (error) {
            console.warn('Failed to get saved language preference:', error);
            return null;
        }
    }

    // Initialize with saved preference or auto-detect
    async initWithPreference() {
        const savedLanguage = this.getSavedLanguage();
        const languageToUse = savedLanguage && this.supportedLanguages.includes(savedLanguage) 
            ? savedLanguage 
            : this.detectLanguage();
            
        console.log(`Using language: ${languageToUse}${savedLanguage ? ' (saved preference)' : ' (auto-detected)'}`);
        
        const success = await this.loadTranslations(languageToUse);
        if (success) {
            this.updatePageContent();
        }
        
        return success;
    }

    // Get current language
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // Get supported languages
    getSupportedLanguages() {
        return [...this.supportedLanguages];
    }
}

// Create global i18n instance
window.i18n = new I18n(); 