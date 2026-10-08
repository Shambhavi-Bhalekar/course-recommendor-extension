// Clicking the toolbar icon opens the side panel next to the Meet tab.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
