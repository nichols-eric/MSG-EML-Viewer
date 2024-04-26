// Function to parse .msg headers
function parseHeaders(headers) {
    var parsedHeaders = {};
    if (!headers) {
        return parsedHeaders;
    }
    var headerRegEx = /(.*)\: (.*)/g;
    while (m = headerRegEx.exec(headers)) {
        // todo: Pay attention! Header can be presented many times (e.g. Received). Handle it, if needed!
        parsedHeaders[m[1]] = m[2];
    }
    return parsedHeaders;
}

// Function to extract date from .msg headers
function getMsgDate(rawHeaders) {
    var headers = parseHeaders(rawHeaders);
    if (!headers['Date']) {
        return 'Unknown';
    }
    var date = new Date(headers['Date']).toLocaleString();
    return date;
}

// Function to fetch the raw data of the .msg file and populate overlay with parsed data
async function fetchMsgContent(msgUrl) {
    try {
        const response = await fetch(msgUrl);
        const buffer = await response.arrayBuffer();
        const msgReader = new MSGReader(new Uint8Array(buffer));
        const fileData = msgReader.getFileData();

        // Display content
        displayMsgContent(fileData, msgReader);
    } catch (error) {
        console.error('Error fetching or parsing .msg file:', error);
    }
}

// Function to fetch the raw data of the .eml file and populate overlay with parsed data
async function fetchEmlContent(emlUrl) {
  try {
    // Dynamically import postal-mime.js, chrome extension manifest v3 will not treat it as a normal content_scripts
    // It imports several other scripts from the same local repo, several of which are likely not needed
    const { default: PostalMime } = await import(chrome.runtime.getURL("postal-mime/postal-mime.js"));
    const response = await fetch(emlUrl);
    const buffer = await response.arrayBuffer();

    // Parse the .eml data using PostalMime
    var emlReaderPromise = PostalMime.parse(buffer);
    var emlReader = await emlReaderPromise;

    // Extract relevant information
    const emlMessage = {
      date: emlReader.date,
      from: await getFromAddress(emlReader),
      to: await getRecipients(emlReader),
      subject: await getSubject(emlReader),
      body: await getBody(emlReader),
      attachments: emlReader.attachments,
    };
    displayEmlContent(emlMessage);

  } catch (error) {
    console.error('Error fetching or parsing .eml file:', error);
  }
}


function displayEmlContent(emlMessage) {
    const attachments = emlMessage.attachments;
    const launchURL = new URL(window.location.href);
    const filePath = launchURL.searchParams.get('file');

    // Populate overlay with parsed data
    // Wrap the message body in a <pre> tag to preserve formatting
    const emlHtml = `
        <div>
            <h2>From: ${emlMessage.from}</h2>
            <h2>To: ${emlMessage.to.join(", ")}</h2>
            <h2>Date: ${emlMessage.date}</h2>
            <h2>Subject: ${emlMessage.subject}</h2>
            ${emlMessage.body}
            <h2>Attachments:</h2>
            <div id="attachmentList"></div>
        </div>
    `;

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.setAttribute('id', 'emlOverlay');
    overlay.innerHTML = emlHtml;

    // Style overlay
    overlay.style.position = 'fixed';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.padding = '20px';
    overlay.style.borderRadius = '10px';
    overlay.style.overflowY = 'auto'; // Add vertical scroll bars if content overflows

    overlay.style.zIndex = '9999';

    if (filePath) {
        // If filePath is present, adjust border, width, and height
        overlay.style.border = 'none'; // Remove border
        overlay.style.width = '95%';
        overlay.style.height = '95%';
    overlay.style.backgroundColor = 'rgba(255, 255, 255, 1)'; // no transparency

    } else {
        // Otherwise, keep the border, width, and height as before
        overlay.style.border = '2px solid black';
        overlay.style.width = '80%';
        overlay.style.height = '80%';
    overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // Semi-transparent white background

    }

    // Append overlay to body
    document.body.appendChild(overlay);

    // Style dismiss button
    const dismissButton = document.createElement('button');
    dismissButton.setAttribute('id', 'dismissButton');
    dismissButton.innerText = 'Dismiss';
    dismissButton.style.position = 'fixed';
    dismissButton.style.top = '10px'; // Position from the top
    dismissButton.style.left = '10px'; // Position from the left
    dismissButton.style.zIndex = '10000'; // Ensure dismiss button appears above overlay
    overlay.appendChild(dismissButton);

    // Add event listener to dismiss button
    dismissButton.addEventListener('click', () => {

        if (filePath) {
            // If page was loaded with a query parameter, close the entire page
            window.close();
        } else {
            // Otherwise, remove overlay when dismiss button is clicked
            overlay.remove();
        }

    });

    // Create attachment list
    const attachmentList = document.getElementById('attachmentList');

    // Loop through attachments to create a formatted list
    attachments.forEach(async (attachment, index) => {

        try {
            // Fetch attachment content
            const attachmentContent = attachment;

            // Create a download link for the attachment
            const downloadLink = document.createElement('a');

            /////you can use either blob or file object below
            // downloadLink.href = URL.createObjectURL(new Blob([attachmentContent.content], { type: attachment.mimeType }));

            /////you can use either file or blob object above
            // Create a File object using the File constructor
            const file = new File([attachmentContent.content], attachmentContent.filename, { type: [attachmentContent.mimeType] });
            // Create a URL for the File object
            const fileUrl = URL.createObjectURL(file);
            // Set the download link href attribute to the URL of the File object
            downloadLink.href = fileUrl;

            downloadLink.download = attachmentContent.filename;
            
            // Add size and MIME type information to the download link
            const fileSizeKB = Math.ceil(file.size / 1024); // Convert bytes to kilobytes
            downloadLink.innerText = attachmentContent.filename;
            
            const attachmentInfo = document.createElement('div');
            attachmentInfo.innerText = `[${fileSizeKB} KB]${attachmentContent.contentId ? '; ' + attachmentContent.contentId : ''}`;
            
            // Append download link and attachment info to attachment list
            attachmentList.appendChild(downloadLink);
            attachmentList.appendChild(document.createTextNode(' ')); // Add space between link and info
            attachmentList.appendChild(attachmentInfo);
            
            // Append a line break after each download link
            attachmentList.appendChild(document.createElement('br'));
        } catch (error) {
            console.error('Error fetching .eml attachment content:', error);
        }



    });

}


function getFromAddress(emlReader) {
  const from = emlReader.from?.address || "";
  return from;
}

function getRecipients(emlReader) {
  return emlReader.to?.map((recipient) => recipient.address) || [];
}

function getSubject(emlReader) {
  return emlReader.subject || "";
}

async function getBody(emlReader) {
  // Directly access the "text" and "html" properties
  const textBody = emlReader.text || "";
  const htmlBody = emlReader.html || "";

  // If both text and html exist, wrap html in <pre> tags
  if (textBody && htmlBody) {
    return `<pre>${htmlBody}</pre>` + textBody;
  }

  // Return whichever body part is available
  return textBody || htmlBody;
}


function getAttachments(emlReader) {
  // Check for attachment nodes within the message structure
  return emlReader.attachments.map((attachment) => ({
    filename: attachment.filename || "attachment",
    mimeType: attachment.mimeType,
    // You might need additional logic to handle attachment data retrieval
    // based on PostalMime's attachment handling capabilities.
  }));
}

// Function to display the .msg content in an overlay
function displayMsgContent(msgContent, msgReader) {
    const launchURL = new URL(window.location.href);
    const filePath = launchURL.searchParams.get('file');

    // populate overlay with parsed data
    const recipients = msgContent.recipients.map(recipient => recipient.name).join(', ');
    const attachments = msgContent.attachments;

    const headers = msgContent.headers;
    const date = getMsgDate(headers);

    // Wrap the message body in a <pre> tag to preserve formatting
    const body = `<pre>${msgContent.body}</pre>`;

    const msgHtml = `
        <div>
            <h2>From: ${msgContent.senderName}</h2>
            <h2>To: ${recipients}</h2>
            <h2>Date: ${date}</h2>
            <h2>Subject: ${msgContent.subject}</h2>
            ${body}
            <h2>Attachments:</h2>
            <div id="attachmentList"></div>
        </div>
    `;

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.setAttribute('id', 'msgOverlay');
    overlay.innerHTML = msgHtml;

    // Style overlay
    overlay.style.position = 'fixed';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.padding = '20px';
    overlay.style.borderRadius = '10px';
    overlay.style.overflowY = 'auto'; // Add vertical scroll bars if content overflows
    overlay.style.zIndex = '9999';

    if (filePath) {
        // If filePath is present, adjust border, width, and height
        overlay.style.border = 'none'; // Remove border
        overlay.style.width = '95%';
        overlay.style.height = '95%';
    overlay.style.backgroundColor = 'rgba(255, 255, 255, 1)'; // no transparency

    } else {
        // Otherwise, keep the border, width, and height as before
        overlay.style.border = '2px solid black';
        overlay.style.width = '80%';
        overlay.style.height = '80%';
    overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // Semi-transparent white background

    }

    // Append overlay to body
    document.body.appendChild(overlay);

    // Style dismiss button
    const dismissButton = document.createElement('button');
    dismissButton.setAttribute('id', 'dismissButton');
    dismissButton.innerText = 'Dismiss';
    dismissButton.style.position = 'fixed';
    dismissButton.style.top = '10px'; // Position from the top
    dismissButton.style.left = '10px'; // Position from the left
    dismissButton.style.zIndex = '10000'; // Ensure dismiss button appears above overlay
    overlay.appendChild(dismissButton);

    // Add event listener to dismiss button
    dismissButton.addEventListener('click', () => {

        const launchURL = new URL(window.location.href);
        const filePath = launchURL.searchParams.get('file');
        if (filePath) {
            // If page was loaded with a query parameter, close the entire page
            window.close();
        } else {
            // Otherwise, remove overlay when dismiss button is clicked
            overlay.remove();
        }

    });

    // Create attachment list
    const attachmentList = document.getElementById('attachmentList');

    // Loop through attachments to create a formatted list
    attachments.forEach(async (attachment, index) => {

        try {
            // Fetch attachment content
            const attachmentContent = await msgReader.getAttachment(index);

            // Create a download link for the attachment
            const downloadLink = document.createElement('a');

            /////you can use either blob or file object below
            //downloadLink.href = URL.createObjectURL(new Blob([attachmentContent.content], { type: attachment.mimeType }));


            /////you can use either file or blob object above
            // Create a File object using the File constructor
            const file = new File([attachmentContent.content], attachment.fileName, { type: attachment.mimeType });
            // Create a URL for the File object
            const fileUrl = URL.createObjectURL(file);
            // Set the download link href attribute to the URL of the File object
           downloadLink.href = fileUrl;

            downloadLink.download = attachment.fileName;
            
            // Add size and MIME type information to the download link
            const fileSizeKB = Math.ceil(attachment.contentLength / 1024); // Convert bytes to kilobytes
            downloadLink.innerText = attachment.fileName;
            
            const attachmentInfo = document.createElement('div');
            attachmentInfo.innerText = `[${fileSizeKB} KB]${attachment.pidContentId ? '; ' + attachment.pidContentId : ''}`;
            
            // Append download link and attachment info to attachment list
            attachmentList.appendChild(downloadLink);

            attachmentList.appendChild(document.createTextNode(' ')); // Add space between link and info
            attachmentList.appendChild(attachmentInfo);
            
            // Append a line break after each download link
            attachmentList.appendChild(document.createElement('br'));
        } catch (error) {
            console.error('Error fetching attachment content:', error);
  //console.error('Error stack:', error.stack); // Optional: Log the error stack for more details

        }
    });
}

// Function to replace .msg URLs with dynamic HTML content viewer
function replaceMsgUrls() {
  const msgUrls = document.querySelectorAll('a[href$=".msg"]');
  msgUrls.forEach(msgUrl => {
    // Check if the URL is already processed
    if (!msgUrl.getAttribute('data-msg-processed')) {
      msgUrl.setAttribute('data-msg-processed', true);
      console.log("Processed", msgUrl.href);
      msgUrl.addEventListener('click', function(event) {
        event.preventDefault();
        const msgFileUrl = msgUrl.href;
        if (msgFileUrl) {
          fetchMsgContent(msgFileUrl);
        } else {
          console.error("No URL found for clicked element");
        }
      });
    }
  });
}

// Function to replace .eml URLs with dynamic HTML content viewer
function replaceEmlUrls() {
  const emlUrls = document.querySelectorAll('a[href$=".eml"]');
  emlUrls.forEach(emlUrl => {
    // Check if the URL is already processed
    if (!emlUrl.getAttribute('data-eml-processed')) {
      emlUrl.setAttribute('data-eml-processed', true);
      console.log("Processed", emlUrl.href);
      emlUrl.addEventListener('click', function(event) {
        event.preventDefault();
        const emlFileUrl = emlUrl.href;
        if (emlFileUrl) {
          fetchEmlContent(emlFileUrl);
        } else {
          console.error("No URL found for clicked element");
        }
      });
    }
  });
}

// Initial call to replace .msg URLs
replaceMsgUrls();

// Initial call to replace .eml URLs
replaceEmlUrls();

// Listen for DOM changes to detect new .msg URLs and replace them
const msgObserver = new MutationObserver(replaceMsgUrls);
msgObserver.observe(document.body, { childList: true, subtree: true });

// Listen for DOM changes to detect new .eml URLs and replace them
const emlObserver = new MutationObserver(replaceEmlUrls);
emlObserver.observe(document.body, { childList: true, subtree: true });
