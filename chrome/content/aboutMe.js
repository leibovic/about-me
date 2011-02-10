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

Components.utils.import("resource://gre/modules/PluralForm.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var hs = Cc["@mozilla.org/browser/nav-history-service;1"].
         getService(Ci.nsINavHistoryService);
var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
var fs = Cc["@mozilla.org/browser/favicon-service;1"].
        getService(Ci.nsIFaviconService);
var ms = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);

var placesDB = hs.QueryInterface(Ci.nsPIPlacesDatabase).DBConnection;
var downloadsDB = Cc["@mozilla.org/download-manager;1"].
                  getService(Ci.nsIDownloadManager).DBConnection;

// for localization
var gStringBundle = document.getElementById("strings");

function LOG(aMsg) {
  Cc["@mozilla.org/consoleservice;1"].
    getService(Ci.nsIConsoleService).
    logStringMessage("ABOUT:ME: " + aMsg);
  dump("ABOUT:ME: " + aMsg + "\n");
}

var AboutMe = {
  maxDownloads: [0, 0],
  dDAvg: [],

  init: function AM_init () {
    this.checkUserData();

    this.fillActivityStartDate();
    this.fillDownloadsStartDate();

    this.fillMostVisitedSites();
    this.fillHourlyActivity();

    this.fillDownloadsStats();
    this.fillDownloadsPieChart();
    this.fillDailyDownloads();
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
    // check that downloads history exists
    me.processQuery({
      db: downloadsDB,
      query: "SELECT COUNT(id) as count FROM moz_downloads",
      handleRow: function checkUserDownloads_handleRow (aRow) {
        let count = aRow.getResultByName("count");
        if (count == 0) {
          let msg = $("<div>").addClass("no-content-message").
                    text(gStringBundle.getString("noDownloadsMessage"));
          $("div#downloads-contents").hide().after(msg);  
          $("#downloads-start").hide();
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

  fillDownloadsStartDate: function AM_fillDownloadsStartDate () {
    let me = this;
    me.processQuery({
      db: downloadsDB,
      query: "SELECT strftime('%s', MIN(startTime)/1000000, 'unixepoch', 'localtime') as time  \
              FROM moz_downloads",
      handleRow: function fillDonwloadsStartDate_handleRow (aRow) {
        let time = aRow.getResultByName("time");
        let text = gStringBundle.getFormattedString("since", [me.prettyTime(time)]);
        $("#downloads-start").text(text);
      }
    });
  },

  // most visited sites -------------------------------------------------------

  fillMostVisitedSites: function AM_fillMostVisitedSites () {
    let me = this;
    me.processQuery({
      query: "SELECT rev_host as rev_host, SUM(visit_count) as visits \
              FROM moz_places GROUP BY rev_host \
              ORDER BY SUM(visit_count) DESC LIMIT 10",
      handleRow: function fillMostVisitedSites_handleRow (aRow) {
        let rev_host = aRow.getResultByName("rev_host");
        let visits = aRow.getResultByName("visits");
        if (!rev_host || !visits)
          return;

        let domain = me.prettyDomain(rev_host);
        let href = me.hrefDomain(rev_host);
        
        let favicon = fs.getFaviconImageForPage(ios.newURI(href, null, null)).spec;
        let label = $("<div>").append($("<a>").text(domain).attr("href", href)).
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
      query: "SELECT url, title, visit_count \
              FROM moz_places WHERE rev_host = :rh \
              ORDER BY visit_count DESC LIMIT 5",
      params: { rh: row.data("data") },
      handleRow: function renderTotalDetails_handleRow (aRow) {        
        let url = aRow.getResultByName("url");
        let title = aRow.getResultByName("title");
        if (!title)
          title = url;
        title = title.length > 60 ? title.substring(0, 60) + "..." : title;

        let favicon = fs.getFaviconImageForPage(ios.newURI(url, null, null)).spec;

        let visits = aRow.getResultByName("visit_count");
        let visitForm = gStringBundle.getString("totalVisitCount");
        let visitText = PluralForm.get(visits, visitForm)
                                  .replace("#1", visits);

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
      query: "SELECT h.rev_host as rev_host, COUNT(v.id) as num_visits, \
              strftime('%H', v.visit_date/1000/1000, 'unixepoch', 'localtime') as hour \
              FROM moz_historyvisits v LEFT JOIN moz_places h ON v.place_id = h.id \
              WHERE hour = :hour AND v.visit_type \
              NOT IN (0, 4) AND rev_host IS NOT NULL \
              GROUP BY rev_host ORDER BY num_visits DESC LIMIT 5",
      params: { hour: index < 10 ? "0" + index : index },
      handleRow: function renderHourlyDetails_handleRow (aRow) {
        let rev_host = aRow.getResultByName("rev_host");
        let href = me.hrefDomain(rev_host);
        let domain = me.prettyDomain(rev_host);

        let favicon = fs.getFaviconImageForPage(ios.newURI(href, null, null)).spec;
        
        let hour_visits = aRow.getResultByName("num_visits");
        let visitForm = gStringBundle.getString("hourlyVisitCount");
        let visitText = PluralForm.get(hour_visits, visitForm)
                                  .replace("#1", hour_visits);

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

  // daily downloads trends ---------------------------------------------------

  fillDailyDownloads: function AM_fillDailyDownloads () {
    let me = this;
    $("table#daily-downloads").barGraph({ type: "daily", barCount: 2 });
    
    me.processQuery({
      db: downloadsDB,
      query: "SELECT COUNT(*) as number, \
              ROUND(SUM(CAST(maxBytes AS FLOAT))/1048576, 2) as size, \
              strftime('%w', endTime/1000000, 'unixepoch', 'localtime') as day \
              FROM moz_downloads GROUP BY day ORDER BY day ASC",
      handleRow: function fillDownloads_handleRow (aRow) {
        let day = aRow.getResultByName("day");      

        let items = aRow.getResultByName("number");
        let itemForm = gStringBundle.getString("itemCount");
        let itemText = PluralForm.get(items, itemForm).replace("#1", items);
        $("table#daily-downloads").barGraph({
          index: day,
          value: items,
          label: itemText,
          renderDetails: me.renderDownloadsDetails,
          type: 0
        });
        
        let size = aRow.getResultByName("size");
        let sizeForm = gStringBundle.getString("mbCount");
        let sizeText = PluralForm.get(size, sizeForm).replace("#1", size);
        $("table#daily-downloads").barGraph({
          index: day,
          value: size,
          label: sizeText,
          renderDetails: me.renderDownloadsDetails,
          type: 1
        });
      }
    });
  },

  // for a given day of the week:
  // average bytes downloaded, average number of downloads
  // 5 largest downloads (startTime, endTime, maxBytes, name, source, referrer)
  renderDownloadsDetails: function AM_renderDownloadsDetails (detailsRow) {
    let me = AboutMe;
    let index = detailsRow.attr("index");
    me.processQuery({
      db: downloadsDB,
      query: "SELECT COUNT(*) as number, \
              ROUND(SUM(CAST(maxBytes AS FLOAT))/1048576, 2) as mb, \
              strftime('%w', endTime/1000000, 'unixepoch', 'localtime') as day, \
              strftime('%m-%d-%Y', endTime/1000000, 'unixepoch', 'localtime') as date \
              FROM moz_downloads WHERE day = :day GROUP BY date \
              ORDER BY endTime DESC",
      params: { day: index },
      handleRow: function fillDownloadsDetailsStats_handleRow (aRow) {        
        let day = aRow.getResultByName("day");
        let mb = aRow.getResultByName("mb");
        let number = aRow.getResultByName("number");

        // maintain average number of downloads and avaerage download size
        // todo: make this more readable
        if (me.dDAvg[day]) {
          me.dDAvg[day][0][0] = Math.round((me.dDAvg[day][0][0] + number) /
                                (me.dDAvg[day][0][1]++)*100)/100;
          me.dDAvg[day][1][0] = Math.round((me.dDAvg[day][1][0] + mb) /
                                (me.dDAvg[day][1][1]++)*100)/100;
        } else 
          me.dDAvg[day] = [[number, 1], [mb, 1]];

        // update stats span or create a new one if it doesn't exist
        let numForm = gStringBundle.getString("averageNumberOfDownloads");
        let numText = PluralForm.get(me.dDAvg[day][0][0], numForm)
                                .replace("#1", me.dDAvg[day][0][0]);
        let sizeForm = gStringBundle.getString("averageDownloadSize");
        let sizeText = PluralForm.get(me.dDAvg[day][1][0], sizeForm)
                                 .replace("#1", me.dDAvg[day][1][0]);
        
        // todo: make sure this is inserted before other details
        if ($("td", detailsRow).length == 0) 
          detailsRow.append($("<td>").attr("colspan", 0));
          
        if ($("div.stats", detailsRow).length > 0)
          $("td div.stats", detailsRow).html(numText + "<br/>" + sizeText);
        else
          $("td", detailsRow).append($("<div>").addClass("stats").
                                                html(numText + "<br/>" + sizeText));
      }
    });

    me.processQuery({
      db: downloadsDB,
      query: "SELECT name, source, ROUND(CAST(maxBytes AS FLOAT)/1048576, 2) as size, \
              startTime/1000 as start, endTime/1000 as end, target, \
              strftime('%s', endTime/1000000, 'unixepoch', 'localtime') as time, \
              strftime('%w', endTime/1000000, 'unixepoch', 'localtime') as day \
              FROM moz_downloads WHERE day = :day ORDER BY maxBytes DESC LIMIT 5",
      params: { day: index },
      handleRow: function fillDownloadsDetailsList_handleRow (aRow) {
        let img = $("<img>").attr("src", "moz-icon://" + 
                                         aRow.getResultByName("target") + 
                                         "?size=16");
        let name = $("<a>").text(aRow.getResultByName("name")).
                            attr("href", aRow.getResultByName("source"));

        let size = aRow.getResultByName("size");
        let sizeForm = gStringBundle.getString("mbCount");
        let sizeText = $("<span>").text("(" + PluralForm.get(size, sizeForm).
                                              replace("#1", size) + ")");
        let timeText = $("<span>").addClass("time").
                                   text(me.prettyTime(aRow.getResultByName("time")));
        
        let content = $("<div>").append(img).append(name).
                                 append(sizeText).append(timeText);
        
        if ($("td", detailsRow).length == 0)
          detailsRow.append($("<td>").attr("colspan", 0));
        
        // todo: make sure this is inserted after stats
        $("td", detailsRow).append(content);
      }
    });
  },


  // downloads stats ----------------------------------------------------------
  
  fillDownloadsStats: function AM_fillDownloadsStats () {
    let me = this;
    me.processQuery({
      db: downloadsDB,
      query: "SELECT COUNT(*) as total, ROUND(SUM(maxBytes)/1048576, 2) as mb, \
              ROUND(AVG(maxBytes)/1048576, 2) as avg FROM moz_downloads \
              WHERE state = 1",
      handleRow: function fillDownloadsStats_handleRow (aRow) {
        let total = aRow.getResultByName("total");
        let statsForm = gStringBundle.getString("downloadStats");
        let statsText = PluralForm.get(total, statsForm)
                                  .replace("#1", total)
                                  .replace("#2", aRow.getResultByName("mb"))
                                  .replace("#3", aRow.getResultByName("avg"));
        $("div#downloads-stats").text(statsText);
      }
    });
  },

  // download media types -----------------------------------------------------

  fillDownloadsPieChart: function AM_fillDownloadsPieChart () {
    let me = this;
    me.processQuery({
      db: downloadsDB,
      query: "SELECT COUNT(*) as count, mimeType FROM moz_downloads \
              GROUP BY mimeType ORDER BY count DESC",
      handleRow: function fillDownloadsPieChart_handleRow (aRow) {
        let mimeType = aRow.getResultByName("mimeType");

        let label = ms.getFromTypeAndExtension(mimeType, null).description || 
                    mimeType;
        if (label.length > 30)
          label = label.substr(0, 30) + "...";
          
        if (mimeType == "application/octet-stream" || mimeType == "" || 
            $("table#downloads-pie").data("colorCounter") > 5) {
          mimeType = "other";
          label = gStringBundle.getString("otherTypes");
        }
        
        $("table#downloads-pie").pieChart({
          key: mimeType,
          value: aRow.getResultByName("count"),
          label: label,
          renderDetails: me.renderPieChartDetails
        });
      }
    });
  },

  renderPieChartDetails: function AM_renderPieChartDetails (detailsDiv) {
    let me = AboutMe;
    let key = detailsDiv.attr("key");
    let container = detailsDiv.parents("tr");
    let item = $("td.legend div[key='" + key + "']", container);
    
    let handleRow = function renderPieChartDetails_handleRow (aRow) {
      let img = $("<img>").attr("src", "moz-icon://" + 
                                       aRow.getResultByName("target") + 
                                       "?size=16");
      let name = $("<a>").text(aRow.getResultByName("name")).
                          attr("href", aRow.getResultByName("source"));        
      let time = $("<span>").addClass("time").
                             text(me.prettyTime(aRow.getResultByName("time")));
      let content = $("<div>").append(img).append(name).append(time)
      
      detailsDiv.attr("key", key).append(content);
    }
    
    if (key == "other") {
      let whereClauses = [];
      $("td.legend div", container).each(function () {
        whereClauses.push("mimeType <> '" + $(this).attr("key") + "'");
      });
      me.processQuery({
        db: downloadsDB,
        query: "SELECT name, source, target, mimeType, \
                ROUND(CAST(maxBytes AS FLOAT)/1048576, 2) as size, \
                strftime('%s', endTime/1000000, 'unixepoch', 'localtime') as time \
                FROM moz_downloads WHERE " + whereClauses.join(" AND ") + " \
                ORDER BY endTime DESC LIMIT 5",
        handleRow: handleRow
      });
    } else {    
      me.processQuery({
        db: downloadsDB,
        query: "SELECT name, source, target, mimeType, \
                ROUND(CAST(maxBytes AS FLOAT)/1048576, 2) as size, \
                strftime('%s', endTime/1000000, 'unixepoch', 'localtime') as time \
                FROM moz_downloads WHERE mimeType = :type \
                ORDER BY endTime DESC LIMIT 5",
        params: { type: key },
        handleRow: handleRow
      });
    }
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

  processQuery: function AM_processQuery (aItem) {
    if (!aItem.query.length)
      return;

    var db = aItem.db || placesDB;
    var stmt = db.createStatement(aItem.query);

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

$(document).ready(function(){
  AboutMe.init();
});
