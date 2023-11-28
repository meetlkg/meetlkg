/* eslint-disable no-undef */
var plenaUrls = ['https://gokul.fyi/plena/', 'https://gokul.fyi/plena-atomic/', 'http://localhost:8081/desktop', 'http://localhost:8081/desktop-atomic', 'https://test.hypersdr.plena.io/desktop', 'https://test.hypersdr.plena.io/desktop-atomic'];

async function pinTab(_, __,tab) {
  // check if tab is not pinned and its plena url
  if(!tab.pinned && plenaUrls.includes(tab.url)){

    //get if plena window is available in storage
    chrome.storage.session.get(['PLENA_WINDOW'], function(result) {
      if(Object.keys(result).length != 0){
        // move tab to the plena window
        chrome.tabs.move(
          tab.id, {windowId: result['PLENA_WINDOW'], index: -1}   
        )
      } else {
        // store the original window ID in storage
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        chrome.storage.session.set({'ORIGINAL_WINDOW': tab.windowId}, function() {});

        // create new plena window and move the plena tab to it
        chrome.windows.create({
          tabId: tab.id,
          focused: false,
          state: 'minimized'
          }, function(newWindow){
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            chrome.storage.session.set({'PLENA_WINDOW': newWindow.id}, function() {});
          });
      }

      // update plena tab to pin
      chrome.tabs.update(tab.id, { pinned : true });

      // // check if plena tab is available in storage
      // chrome.storage.session.get(['PLENA_TABS'], function(result) {
      //   // add the tab as plena tab in storage 
      //   if(Object.keys(result).length != 0){
      //     var plenaTab = result['PLENA_TABS'];
      //     plenaTab.push(tab.id);
      //     console.log('setting',plenaTab);
      //     chrome.storage.session.set({'PLENA_TABS': plenaTab}, function(data) {
      //       console.log('setting','PLENA_TABS is set to ' + data);
      //     });
      //   }
      //   else{
      //     // eslint-disable-next-line @typescript-eslint/no-empty-function
      //     chrome.storage.session.set({'PLENA_TABS':[tab.id]}, function() {});
      //   }
      // });
    });   
  }
}

function plenaWindowFocused(windowId){
  console.log('listner', windowId);
  chrome.storage.session.get(['PLENA_WINDOW'], function(result) {
    if(Object.keys(result).length != 0 && windowId == result['PLENA_WINDOW']){
      chrome.storage.session.get(['ORIGINAL_WINDOW'], function(resultChild) {
        if(Object.keys(resultChild).length != 0){
          chrome.windows.update(resultChild['ORIGINAL_WINDOW'], {focused: true});
          chrome.windows.update(result['PLENA_WINDOW'], {focused: false, state: 'minimized'});
        }
      });
    }
  });
  
  // // find the url of tab getting focused
  // chrome.tabs.get(activeInfo.newTabId, function(tab){

  //   // if tab is plena url, take focus back to old tab
  //   if(plenaUrls.includes(tab.url)){
  //     chrome.tabs.update(activeInfo.oldTabId, { active : true });
  //   }
  //   else{

  //     // if tab is a plena tab in storage, take focus to old tab
  //     chrome.storage.session.get(['PLENA_TABS'], function(result) {
  //       console.log('getting',result);
  //       if(Object.keys(result).length != 0){
  //         var plenaTabs = result['PLENA_TABS'];
  //         if(plenaTabs.includes(activeInfo.newTabId)){
  //           chrome.tabs.update(activeInfo.oldTabId, { active : true });
  //         }
  //       }
  //     });
  //   }
  // });
}

chrome.tabs.onCreated.addListener(pinTab);
chrome.tabs.onUpdated.addListener(pinTab);
chrome.windows.onFocusChanged.addListener(plenaWindowFocused)
