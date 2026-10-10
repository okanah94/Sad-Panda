# SadPanda
Chrome/Chromium extension to access ExHentai

# Installation
* Clone this repository or download the ZIP and extract it
* Navigate to `chrome://extensions`
* Toggle the Developer Mode slider in the top right corner
* Click on `Load Unpacked` and navigate to the folder where you have the extension
* Navigate to https://exhentai.org/
* Log in and enjoy!

# Update

* Migration of manifest 2 to version 3
* Rework of some scripts to work with manifest 3

# Fix

* Manifest version 2 deprecated errors
* Login form not showing on the blank ExHentai page
* Login requests blocked by CORS, now sent from the background service worker
* Cookies copied before the page reloads
* Existing e-hentai.org sessions are picked up automatically
* Sign out link for the current ExHentai menu layout
* Removed Vue and Bootstrap JS, which do not run under Manifest V3 content script restrictions
* Saved credentials moved from page localStorage to extension storage
 
