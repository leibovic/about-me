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


var gStringBundle = document.getElementById("strings");

var TopTrendsChart = {
  chartWidth: 460,
  
  createChart: function TTC_createChart (table) {
    table.addClass("top-trends-chart");
  },
  
  addRow: function TTC_addRow (table, params) {
    let me = this;
    
    // assumes that values will be descending
    let barWidth = me.computeBarWidth(table, params.value);
    let numWidth = me.chartWidth - barWidth - 5;

    let bar = $("<div>").addClass("bar").width(barWidth).
              click(function (e) { me.toggleDetails(e, params.renderDetails); });
    let num = $("<div>").addClass("num").width(numWidth).text(params.value);
    let data = $("<td>").addClass("data").width(me.chartWidth).
                         append(bar).append(num);
    
    let label = $("<td>").addClass("label").html(params.label);
    let row = $("<tr>").append(label).append(data).data("data", params.data);
    
    table.append(row);
  },
  
  toggleDetails: function TTC_expandDetails (event, renderDetails) {
    let row = $(event.target).parents("tr");
    
    if (row.hasClass("expanded")) {
      row.removeClass("expanded");
      $("div.details", row).hide();
    } else if (row.hasClass("details-rendered")) {
      row.addClass("expanded");
      $("div.details", row).show();
    } else {
      row.addClass("expanded").addClass("details-rendered");
      renderDetails(row);
    }
  },
  
  computeBarWidth: function TTC_computeBarWidth (table, value) {
    let me = this;
    if (!table.data("maxValue") || value > table.data("maxValue"))
      table.data("maxValue", value);
      
    return Math.round((me.chartWidth - 60) * value / table.data("maxValue"));
  }
  
}

var BarGraph = {
  graphHeight: 200,
  
  createGraph: function BG_createGraph (table, params) {
    params = $.extend({ barCount: 1 }, params);
    
    let data = $("<tr>").addClass("data");
    let labels = $("<tr>").addClass("labels");

    for (let i = 0; i < params.size; i++) {
      for (let j = 0; j < params.barCount; j++) {
        let num = $("<a>").addClass("num").text(0);
        let bar = $("<div>").addClass("bar").height(0);
        data.append($("<td>").attr("index", i).attr("type", j).
                              addClass("column").append(num).append(bar));
      }
      labels.append($("<td>").attr("index", i).attr("colspan", params.barCount).
                              addClass("label").text(params.labels[i]));
    }
        
    table.append(data).append(labels).addClass("bar-graph");
  },
  
  createHourlyTrend: function BG_hourlyTrend (table, params) {
    // todo: localize for 24 hour time
    let labels = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 
                  12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    
    this.createGraph(table, { size: 24, labels: labels });
    
    let am = $("<td>").attr("colspan", 12).text(gStringBundle.getString("AM"));
    let pm = $("<td>").attr("colspan", 12).text(gStringBundle.getString("PM"));
    table.append($("<tr>").addClass("amPm").append(am).append(pm));
  },
  
  createDailyTrend: function BG_createDailyTrend (table, params) {
    let labels = [ gStringBundle.getString("sundayShort"), 
                   gStringBundle.getString("mondayShort"), 
                   gStringBundle.getString("tuesdayShort"), 
                   gStringBundle.getString("wednesdayShort"), 
                   gStringBundle.getString("thursdayShort"), 
                   gStringBundle.getString("fridayShort"), 
                   gStringBundle.getString("saturdayShort") ];
    
    this.createGraph(table, { size: 7, labels: labels, barCount: 2 } );
  },

  fillData: function BG_fillData (table, params) {
    params = $.extend({ type: 0 }, params);
    let me = this;

    let column = $("tr.data td.column[index='" + params.index + 
                   "'][type='" + params.type + "']", table);
    column.data("value", params.value);
    
    $("a.num", column).text(params.label || params.value).
      click(function (e) { me.toggleDetails(e, params.renderDetails); });

    let barHeight = me.computeBarHeight(table, params.value, params.type);
    $("div.bar", column).height(barHeight).
      click(function (e) { me.toggleDetails(e, params.renderDetails); });
  },

  toggleDetails: function BG_toggleDetails (event, renderDetails) {
    let column = $(event.target).parents("td");
    let table = column.parents("table");
    let columns = $("td[index='" + column.attr("index") + "']", 
                    column.parents("tr.data"));
    
    $("tr.details", table).hide();

    if (column.hasClass("selected"))
      columns.removeClass("selected");
    else {
      $("td.selected", column.parents("tr.data")).removeClass("selected");
      columns.addClass("selected");
      
      let index = column.attr("index");
      if (column.hasClass("details-rendered"))
        $("tr.details[index='" + index + "']", table).show();
      else {
        let detailsRow = $("<tr>").addClass("details").attr("index", index);
        renderDetails(detailsRow);
        columns.addClass("details-rendered").parents("table").append(detailsRow);
      }
    }
  },

  computeBarHeight: function BG_computeBarHeight (table, value, type) {    
    let me = this;
    let maxValueKey = "maxValue" + type;

    if (!table.data(maxValueKey))
      table.data(maxValueKey, value);

    if (value <= table.data(maxValueKey))
      return Math.round(me.graphHeight * value / table.data(maxValueKey));

    // update all bar heights if there is a new max value
    table.data(maxValueKey, value);
    $("tr.data td.column[type='" + type + "']", table).each( function (i, td) {
      let column = $(td);
      let height = Math.round(me.graphHeight * column.data("value") / 
                              table.data(maxValueKey));
      $("div.bar", column).height(height);
    });

    return me.graphHeight;
  }
}

var PieChart = {
  createChart: function PC_createChart (table, params) {
    let pie = $("<td>").addClass("pie").append($("<span>"));
    let legend = $("<td>").addClass("legend");
    let details = $("<td>").addClass("details");
    table.addClass("pie-chart").data("colorCounter", 0).
          append($("<tr>").append(pie).append(legend).append(details));
  },
  
  fillData: function PC_fillData (table, params) {
    params = $.extend({ pieColors: ["#B10000", "#CC5500", "#005812", 
                                    "#3269BB", "#03198D", "#330033"] }, params);
    let me = this;

    // update legend with new item
    // legend item holds data about the pie chart    
    let item = $("td.legend div[key='" + params.key + "']", table);
    if (item.length > 0) {
      let value = item.data("value") + params.value;
      item.data("value", value);
      item.text(params.label + ": " + value);
    } else {
      let colorCounter = table.data("colorCounter");
      let color = params.pieColors[colorCounter];
      table.data("colorCounter", colorCounter + 1);
      
      item = $("<div>").attr("key", params.key).
             data("value", params.value).
             attr("style", "color:" + color).
             text(params.label + ": " + params.value).
             click( function (e) { me.toggleDetails(e, params.renderDetails); } );
      $("td.legend", table).append(item);
    }
    
    // re-render pie with new values
    let plotValues = [];
    $("td.legend div", table).each(function () {
      plotValues.push($(this).data("value"));
    });

    // fixes bug where sparklines will not make pie chart with 1 data point
    if (plotValues.length == 1)
      plotValues.push(0);

    $("td.pie span").sparkline(plotValues, { 
      type: "pie", 
      height: "150px", 
      width: "150px", 
      sliceColors: params.pieColors 
    });
  },
  
  toggleDetails: function PC_toggleDetails (event, renderDetails) {
    let item = $(event.target);
    let key = item.attr("key");
    let container = item.parents("tr");

    $("td.details div.details", container).hide();

    if (item.hasClass("selected"))
      item.removeClass("selected");
    else {
      $("div.selected", item.parents("tr")).removeClass("selected");
      item.addClass("selected");
      
      let key = item.attr("key");
      if (item.hasClass("details-rendered"))
        $("td.details div[key='" + key + "']", container).show();
      else {
        let detailsDiv = $("<div>").attr("key", key).addClass("details");
        item.addClass("details-rendered");
        $("td.details", item.parents("table")).append(detailsDiv);
        renderDetails(detailsDiv);
      }
    }
  }
}

$.fn.topTrendsChart = function topTrendsChart (params) {
  if (!this.hasClass("top-trends-chart"))
    TopTrendsChart.createChart(this);
  
  if (params.value)
    TopTrendsChart.addRow(this, params);

  return this;
}

$.fn.barGraph = function barGraph (params) {  
  // initialize the graph if it has not already been created
  if (!this.hasClass("bar-graph")) {
    if (params.type == "hourly")
      BarGraph.createHourlyTrend(this, params);
    else if (params.type == "daily")
      BarGraph.createDailyTrend(this, params);
    else
      BarGraph.createGraph(this, params);
  }
  
  // fill in data if data is specified
  if (params.value)
    BarGraph.fillData(this, params);

  return this; 
}

$.fn.pieChart = function pieChart (params) {
  if (!this.hasClass("pie-chart"))
    PieChart.createChart(this);
  
  if (params.value)
    PieChart.fillData(this, params);
    
  return this;
}
