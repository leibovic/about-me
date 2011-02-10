Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const Cc = Components.classes;
const Ci = Components.interfaces;

function AboutMe() {}
AboutMe.prototype = {
  newChannel : function(aURI)
  {
    if(!aURI.spec == "about:me") return;
    var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var channel = ios.newChannel("chrome://aboutme/content/aboutMe.xhtml", null, null);
    channel.originalURI = aURI;
    return channel;
  },

  getURIFlags: function(aURI)
  {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },

  classDescription: "About Me",
  classID: Components.ID("{5cc26918-9daa-4124-a742-29a1dba85fbd}"),
  contractID: "@mozilla.org/network/protocol/about;1?what=me",
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule])
}

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutMe]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([AboutMe]);
