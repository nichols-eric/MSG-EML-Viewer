console.log('MSG & EML Viewer background.js started');

chrome.runtime.onConnect.addListener((port) => {
  console.log('Connected to options page:', port.name);

  port.onMessage.addListener((message) => {
    if (message.action === 'get_options') {
      console.log('Received message: Get Options');
      chrome.storage.sync.get(['key1', 'key2'], (result) => {
        console.log('Retrieved values from storage:', result);
        port.postMessage(result);
      });
    } else if (message.action === 'save_options') {
      console.log('Received message: Save Options', message.data);
      chrome.storage.sync.set(message.data, () => {
        console.log('Options saved successfully!', message.data);
        port.postMessage({ message: 'Options saved successfully!' });
      });
    } else {
      console.warn('Unknown message action:', message.action);
    }
  });
});
