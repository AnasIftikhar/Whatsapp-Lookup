chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkWhatsApp') {
        const bodyText = document.body.innerText || '';

        // Check for invalid number popup
        if (bodyText.includes('Phone number shared via url is invalid') ||
            bodyText.includes('Phone number shared via URL is invalid')) {
            sendResponse({ status: 'Invalid' });
            return true;
        }

        // Check if chat message input box is present
        const messageInput = document.querySelector('div[role="textbox"][contenteditable="true"]');
        const composeBox = document.querySelector('[data-testid="conversation-compose-box-input"]');
        const chatPanel = document.querySelector('[data-testid="conversation-panel-wrapper"]');

        // Check for "Type a message" placeholder
        const hasTypePlaceholder = document.querySelector('[placeholder*="Type a message"]') ||
            document.querySelector('[data-placeholder*="Type a message"]') ||
            Array.from(document.querySelectorAll('*')).some(el =>
                el.getAttribute('placeholder')?.includes('Type a message') ||
                el.getAttribute('data-placeholder')?.includes('Type a message') ||
                el.getAttribute('aria-label')?.includes('Type a message')
            );

        if (messageInput || composeBox || chatPanel || hasTypePlaceholder) {
            sendResponse({ status: 'Exists' });
            return true;
        }

        // Still loading
        sendResponse({ status: 'Loading' });
    }
    return true;
});