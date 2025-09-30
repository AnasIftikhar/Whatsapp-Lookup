chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkWhatsApp') {
        const bodyText = document.body.innerText || '';

        // Check for invalid number popup
        if (bodyText.includes('Phone number shared via url is invalid') ||
            bodyText.includes('Phone number shared via URL is invalid')) {
            sendResponse({ status: 'Invalid', needsRetry: true });
            return true;
        }

        // Check for valid number indicators
        const messageInput = document.querySelector('div[role="textbox"][contenteditable="true"]');
        const hasTypePlaceholder = document.querySelector('[placeholder*="Type a message"]') ||
            document.querySelector('[data-placeholder*="Type a message"]') ||
            Array.from(document.querySelectorAll('*')).some(el =>
                el.getAttribute('placeholder')?.includes('Type a message') ||
                el.getAttribute('data-placeholder')?.includes('Type a message') ||
                el.getAttribute('aria-label')?.includes('Type a message')
            );

        if (messageInput || hasTypePlaceholder) {
            sendResponse({ status: 'Exists', needsRetry: true });
            return true;
        }

        // Still loading
        sendResponse({ status: 'Loading' });
    }
    return true;
});