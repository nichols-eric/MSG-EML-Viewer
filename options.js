console.log('MSG & EML Viewer options.js loaded');

document.addEventListener('DOMContentLoaded', function() {

var extensionID = chrome.runtime.id;
    // Set the extension ID as the content of the chromeid spans
    const chromeIdSpans = document.getElementsByClassName('chromeid');
    for (let i = 0; i < chromeIdSpans.length; i++) {
        chromeIdSpans[i].textContent = extensionID;
    }

  // Get references to UI elements
  const getOptionsButton = document.getElementById('getOptionsButton');
  const saveOptionsButton = document.getElementById('saveOptionsButton');
  const ITHitAzureURL = document.getElementById('ITHitAzureURL');

  // Connect to background script
  const port = chrome.runtime.connect({ name: 'optionsPageConnection' });

  // Function to send message for getting options
  function getOptions() {
    console.log('Sending message to background script: { action: "get_options" }');
    port.postMessage({ action: 'get_options' });

    port.onMessage.addListener((response) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching options:', chrome.runtime.lastError);
      } else {
        console.log('Received options from background script:', response);
        // Update UI elements with retrieved values (handle potential undefined values)
        ITHitAzureURL.checked = response?.key1 || false;      }
    });
  }

  // Function to send message for saving options
  function saveOptions() {
    const data = {
      key1: ITHitAzureURL.checked,
    };
    console.log('Sending message to background script: { action: "save_options", data: ', data, '}');
    port.postMessage({ action: 'save_options', data: data });

    port.onMessage.addListener((response) => {
      if (chrome.runtime.lastError) {
        console.error('Error saving options:', chrome.runtime.lastError);
      } else {
        console.log('Options saved successfully:', response);
        // Update UI elements directly with saved values
        ITHitAzureURL.checked = data.key1;
        // Optional: Display success message to user (e.g., alert('Options saved!'))
      }
    });
  }

  // Event listeners for buttons
  getOptionsButton.addEventListener('click', getOptions);
  saveOptionsButton.addEventListener('click', saveOptions);

  // Initial retrieval of options on page load
  getOptions();
});
