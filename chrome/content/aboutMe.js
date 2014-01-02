/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is about:me page code.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    Margaret Leibovic <margaret.leibovic@gmail.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by devaring the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not devare
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

let Cc = Components.classes;
let Ci = Components.interfaces;
let Cu = Components.utils;

Cu.import("resource://gre/modules/PluralForm.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var hs = Cc["@mozilla.org/browser/nav-history-service;1"].
         getService(Ci.nsINavHistoryService);
var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

var ms = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);

var placesDB = hs.QueryInterface(Ci.nsPIPlacesDatabase).DBConnection;

// for localization
var gStringBundle = document.getElementById("strings");

function LOG(aMsg) {
  Services.console.logStringMessage("ABOUT:ME: " + aMsg);
}

var AboutMe = {
  dDAvg: [],

  init: function AM_init () {
    this.checkUserData();

    this.fillActivityStartDate();
    this.fillMostVisitedSites();
    this.fillHourlyActivity();
  },

  checkUserData: function AM_checkUserData () {
    let me = this;
    // check that browsing history exists
    me.processQuery({
      query: "SELECT COUNT(id) as count FROM moz_historyvisits",
      handleRow: function checkUserHistory_handleRow (aRow) {
        let count = aRow.getResultByName("count");
        if (count == 0) {
          let msg = $("<div>").addClass("no-content-message").
                    text(gStringBundle.getString("noHistoryMessage"));
          $("div#activity-contents").hide().after(msg);
          $("#activity-start").hide();
        }
      }
    });
  },

  // start dates --------------------------------------------------------------

  fillActivityStartDate: function AM_fillActivityStartDate () {
    let me = this;
    me.processQuery({
      query: "SELECT strftime('%s', MIN(visit_date)/1000000, 'unixepoch', 'localtime') as time  \
              FROM moz_historyvisits",
      handleRow: function fillActivityStartDate_handleRow (aRow) {
        let time = aRow.getResultByName("time");
        let text = gStringBundle.getFormattedString("since", [me.prettyTime(time)]);
        $("#activity-start").text(text);
      }
    });
  },

  // most visited sites -------------------------------------------------------

  fillMostVisitedSites: function AM_fillMostVisitedSites () {
    let me = this;
    me.processQuery({
      query: "SELECT moz_favicons.url as favicon_url, rev_host as rev_host, SUM(visit_count) as visits \
              FROM moz_places \
              INNER JOIN moz_favicons ON moz_places.favicon_id = moz_favicons.id \
              GROUP BY rev_host \
              ORDER BY SUM(visit_count) DESC LIMIT 10",
      handleRow: function fillMostVisitedSites_handleRow (aRow) {
        let favicon = aRow.getResultByName("favicon_url");
        let rev_host = aRow.getResultByName("rev_host");
        let visits = aRow.getResultByName("visits");
        if (!rev_host || !visits)
          return;

        let domain = me.prettyDomain(rev_host);
        let href = me.hrefDomain(rev_host);

        let label = $("<div>").
                    append($("<a>").text(domain).attr("href", href)).
                    append($("<img>").attr("src", favicon).addClass("favicon").
                                      height(16).width(16));

        $("table#most-visited").topTrendsChart({
          value: visits,
          label: label,
          renderDetails: me.renderTotalDetails,
          data: rev_host
        });
      }
    });
  },

  renderTotalDetails: function AM_renderTotalDetails (row) {
    let me = AboutMe;
    me.processQuery({
      query: "SELECT moz_favicons.url AS favicon_url, moz_places.url, moz_places.title, moz_places.visit_count \
              FROM moz_places \
              INNER JOIN moz_favicons ON moz_places.favicon_id = moz_favicons.id \
              WHERE moz_places.rev_host = :rh \
              ORDER BY moz_places.visit_count DESC LIMIT 5",
      params: { rh: row.data("data") },
      handleRow: function renderTotalDetails_handleRow (aRow) {
        let url = aRow.getResultByName("url");
        let visits = aRow.getResultByName("visit_count");
        let visitForm = gStringBundle.getString("totalVisitCount");
        let visitText = PluralForm.get(visits, visitForm)
                                  .replace("#1", visits);

        let favicon = aRow.getResultByName("favicon_url");
        let title = aRow.getResultByName("title");

        if (!title)
          title = url;

        title = title.length > 60 ? title.substring(0, 60) + "..." : title;

        $("td.data", row).append($("<div>").addClass("details").
          append($("<img>").attr("src", favicon).addClass("favicon").
                            height(16).width(16)).
          append($("<a>").text(title).attr("href", url)).
          append($("<span>").text(visitText)));
      }
    });
  },

  // hourly browsing activity -------------------------------------------------

  fillHourlyActivity: function AM_fillHourlyActivity () {
    let me = this;
    $("table#hourly-activity").barGraph({ type: "hourly" });

    me.processQuery({
      query: "SELECT COUNT(*) as num_visits, \
              strftime('%H', visit_date/1000/1000, 'unixepoch', 'localtime') as hour \
              FROM moz_historyvisits v LEFT JOIN moz_places h ON v.place_id = h.id \
              WHERE v.visit_type NOT IN (0, 4) \
              GROUP BY hour ORDER BY hour ASC",
      handleRow: function fillMostVisitedSites_handleRow (aRow) {
        $("table#hourly-activity").barGraph({
          index: parseFloat(aRow.getResultByName("hour")),
          value: aRow.getResultByName("num_visits"),
          renderDetails: me.renderHourlyDetails
        });
      }
    });
  },

  renderHourlyDetails: function AM_renderHourlyDetails (detailsRow) {
    let me = AboutMe;
    let index = detailsRow.attr("index");
    me.processQuery({
      query: "SELECT f.url as favicon_url, h.rev_host as rev_host, COUNT(v.id) as num_visits, \
              strftime('%H', v.visit_date/1000/1000, 'unixepoch', 'localtime') as hour \
              FROM moz_historyvisits v \
              LEFT JOIN moz_places h ON v.place_id = h.id \
              LEFT JOIN moz_favicons f ON h.favicon_id = f.id \
              WHERE hour = :hour AND v.visit_type \
              NOT IN (0, 4) AND rev_host IS NOT NULL \
              GROUP BY rev_host ORDER BY num_visits DESC LIMIT 5",
      params: { hour: index < 10 ? "0" + index : index },
      handleRow: function renderHourlyDetails_handleRow (aRow) {
        let rev_host = aRow.getResultByName("rev_host");
        let href = me.hrefDomain(rev_host);
        let domain = me.prettyDomain(rev_host);
        let hour_visits = aRow.getResultByName("num_visits");
        let visitForm = gStringBundle.getString("hourlyVisitCount");
        let visitText = PluralForm.get(hour_visits, visitForm)
                                  .replace("#1", hour_visits);
        let favicon = aRow.getResultByName("favicon_url");

        let content = $("<div>").append($("<img>").attr("src", favicon).
                                                   addClass("favicon")).
                                 append($("<a>").text(domain).
                                                 attr("href", href)).
                                 append($("<span>").text(visitText));

        if ($("td", detailsRow).length > 0)
          $("td", detailsRow).append(content);
        else
          detailsRow.append($("<td>").attr("colspan", 0).append(content));
      }
    });
  },

  // helper functions ---------------------------------------------------------

  prettyDomain: function AM_prettyDomain (rev_host) {
    return rev_host.reverse().substring(1);
  },

  hrefDomain: function AM_hrefDomain (rev_host) {
    return ["http://", rev_host.reverse().substring(1), "/"].join("");
  },

  // takes unix timestamp (seconds)
  prettyTime: function AM_prettyTime (time) {
    let dateTimeFormat = gStringBundle.getString("dateTimeFormat");
    return (new Date(time*1000)).format(dateTimeFormat);
  },

  // runs a query against the places db
  processQuery: function AM_processQuery (aItem) {
    if (!aItem.query.length)
      return;

    var stmt = placesDB.createStatement(aItem.query);

    if (aItem.params) {
      for (let [name, value] in Iterator(aItem.params)) {
        stmt.params[name] = value;
      }
    }

    stmt.executeAsync({
      handleResult: function(aResultSet) {
        if (aItem.handleRow) {
          for (let row = aResultSet.getNextRow();
               row;
               row = aResultSet.getNextRow()) {
            aItem.handleRow(row);
          }
        } else
          aItem.handler(aResultSet);
      },
      handleError: function(aError) {
        LOG(aError);
      },
      handleCompletion: function(aReason) {
        if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED)
          LOG("Query canceled or aborted!");
      }
    });
    stmt.finalize();
  }
};

String.prototype.reverse = function () {
  return this.split("").reverse().join("");
}

jQuery(document).ready(function(){
  AboutMe.init();
});
