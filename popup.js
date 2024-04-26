// Connect to background script
  let port = chrome.runtime.connect({ name: 'popupPageConnection' });

// Declare ITHitAzureURL as a boolean variable
  let ITHitAzureURL = false;

async function getOptions() {
    console.log('Sending message to background script from popup.js: { action: "get_options" }');
    port.postMessage({ action: 'get_options' });

    return new Promise((resolve, reject) => {
        port.onMessage.addListener((response) => {
            if (chrome.runtime.lastError) {
                console.error('Error fetching options from popup.js:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                console.log('Received options from background script:', response);
                // Update UI elements with retrieved values (handle potential undefined values)
                ITHitAzureURL = response?.key1 || false;
                console.log('ITHitAzureURL in function:', ITHitAzureURL);
                resolve();
            }
        });
    });
}


function handleDrop(event) {
    event.preventDefault();
    const url = event.dataTransfer.getData('text/plain');
    //const urlInput = document.getElementById('urlInput');
    console.log('handleDrop URL dropped:', url);
    fetchFile(url); // Fetch the file immediately after drop
}

function handleFileDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    //const fileInput = document.getElementById('fileInput');
    //fileInput.files = event.dataTransfer.files;
    console.log('handleFileDrop File dropped:', file);
    displayFile(file); // Handle the file immediately after drop
}

function fetchFile(url) {
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            // Create a File object from the fetched Blob
            const filename = url.substring(url.lastIndexOf('/') + 1);
            const file = new File([blob], filename, { type: blob.type });
            // Handle the created File object
            console.log('fetchFile Fetched file:', file);
            displayFile(file);
        })
        .catch(error => console.error('Error fetching file:', error));
}

function displayFile(file) {
    // Handle the dropped file here
    console.log('displayFile: ', file);

    // Convert the file to a blob
    const blob = new Blob([file]);

    // Create a blob URL
    const blobUrl = URL.createObjectURL(blob);

    // Determine the file type based on the extension
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'msg') {
        // File is a .msg
        fetchMsgContent(blobUrl);
    } else if (fileExtension === 'eml') {
        // File is a .eml
        fetchEmlContent(blobUrl);
    } else {
        // Unsupported file type
        console.error('Unsupported file type');
    }
}

  // Add keydown event listener to the URL input
  urlInput.addEventListener('keydown', function(event) {
    if (event.keyCode === 13) {
      // Enter key pressed, trigger button click
      document.getElementById('fetchButton').click();
    }
  });

document.addEventListener('DOMContentLoaded', async () => {

    await getOptions();

    // Check if the page is opened in a window or tab (not from an extension popup)
    const hasSearchQuery = window.location.search !== '';
    // If there is no search query, open a new detached window with the search query added
    if (!hasSearchQuery) {
        const currentURL = window.location.href;
        const newURL = currentURL + '?window=yes'; // Add '?window=yes' to the URL
        const windowFeatures = 'width=800,height=600'; // Define window features as needed
        window.open(newURL, 'DetachedWindow', windowFeatures); //new window loses focus
        window.close(); // Close the current window (extension popup)
    }


    const launchURL = new URL(window.location.href);
    let filePath = launchURL.searchParams.get('file');

console.log('launchURL :', launchURL);
console.log('filePath :', filePath);


    if (filePath) {
        //ITHit protocol handler butchers the url, lets fix it up
        //maybe implement a feature to add an options page where you could add json regex strings so anyone can fixup their url's
        // true means user has opted out
        if (ITHitAzureURL == false) {

          if (filePath.includes("@SSL@50909\\DavWWWRoot")) {
            filePath = filePath.replace(/@SSL@50909\\DavWWWRoot\\/, ':50909/');
            filePath = 'https://' + filePath;
            console.log('replaced string ', filePath);
          }
       }

        console.log('using string ', filePath);
        fetchFile(filePath); // Display the file
    } 

    const dropArea = document.getElementById('dropArea');
    dropArea.addEventListener('dragover', (event) => {
        event.preventDefault();
    });

    dropArea.addEventListener('drop', (event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes('Files')) {
            handleFileDrop(event);
        } else if (event.dataTransfer.types.includes('text/plain')) {
            handleDrop(event);
        }
    });

    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        console.log('File selected:', file);
        displayFile(file);
    });

    const urlInput = document.getElementById('urlInput');
    const fetchButton = document.getElementById('fetchButton');
    fetchButton.addEventListener('click', () => {
        const url = urlInput.value;
        urlInput.value='';
        console.log('URL entered:', url);
        fetchFile(url);
    });
});
