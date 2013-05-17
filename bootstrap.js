/**
 *
 * This code was inspired by
 * https://github.com/Mardak/restartless/blob/examples/registerService/bootstrap.js
 *
 * All credits to Edward Lee
 *
 */

"use strict";

const {interfaces: Ci, manager: Cm, results: Cr, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// about:me constants
const aboutMeContract = "@mozilla.org/network/protocol/about;1?what=me";
const aboutMeDescription = "About Me";
const aboutMeUUID = Components.ID("5cc26918-9daa-4124-a742-29a1dba85fbd");

// about:me factory
let aboutMeFactory =
{
  createInstance: function(outer, iid)
  {
    if (outer != null)
      throw Cr.NS_ERROR_NO_AGGREGATION;

    return aboutMe.QueryInterface(iid);
  }
};

// about:me
let aboutMe =
{
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

  getURIFlags: function(aURI)
  {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },

  newChannel: function(aURI)
  {
    if (aURI.spec != "about:me")
      return;

    let uri = Services.io.newURI("chrome://aboutme/content/aboutMe.xhtml", null, null);
    return Services.io.newChannelFromURI(uri);
  }
};

function startup(data, reason)
{
  Cm.QueryInterface(Ci.nsIComponentRegistrar).
    registerFactory(aboutMeUUID, aboutMeDescription, aboutMeContract, aboutMeFactory);
}

function shutdown(data, reason)
{
  Cm.QueryInterface(Ci.nsIComponentRegistrar).
    unregisterFactory(aboutMeUUID, aboutMeFactory);
}

function install(data, reason) {}

function uninstall(data, reason) {}