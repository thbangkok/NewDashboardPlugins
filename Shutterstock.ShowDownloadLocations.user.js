// ==UserScript==
// @name         Shutterstock.NewDashboardPlugins
// @namespace    
// @version      1.6.8
// @updateURL    https://github.com/thbangkok/NewDashboardPlugins/raw/master/Shutterstock.ShowDownloadLocations.user.js
// @description  Show detailed localization to Shutterstock Latest Downloads map, based on Satinka's https://gist.github.com/satinka/5479a93d389a07d41246
// @author       Naphong Sudthisornyothin, based on Satinka's
// @match        http://submit.shutterstock.com/home.mhtml*
// @match        https://submit.shutterstock.com/home.mhtml*
// @match        https://submit.shutterstock.com/dashboard*
// @copyright    2017, Naphong
// @require      http://code.jquery.com/jquery-latest.min.js
// @require      https://code.jquery.com/ui/1.11.4/jquery-ui.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/rollups/md5.js 
// @grant        none

// ==/UserScript==
/* jshint -W097 */

// NEWS
// v0.1: This is for new ShutterStock Dashboad to show download detailed including location, earning and time plus link to show statistic of images.


'use strict';

var useShortCountryName = false;       // US (true), or United States of America (false) - false is now default as it looks nicer :)
var googleMaps = "https://www.google.com/maps/place/"; 
var displayEarnings = true; // set to false to disable display of earnings for last 7 days and today on top of popup
var displayRecentEarnings = true; // set to false to disable display of earnings for recent images 
var makeOriginalDivsDraggable = true; // makes content on front page draggable, you can move sections around (map, track your sets, graphs, content overview, profile, forum and blog

var noStockSites = "-site:dreamstime.com+-site:shutterstock.com+-site:shutterstock.in+-site:istockphoto.com+-site:fotolia.com+-site:123rf.com+-site:veer.com+-site:istockphoto.com"; 

// not sure why they q= and oq= are used, but here are both :D, can't hurt; i could do it much nicer, maybe in the future... :)
// Google Images sometimes ignores excludes and will serve content from SS or other excluded sites

var googleSearch = "https://www.google.com/searchbyimage?q=" + noStockSites + "&oq=" + noStockSites + "&image_url=";

var debug = false; // easier for me during development
var trackMySales = false; // for future development, saves info on individual sales in local storage

var div2;
var opened = 0;

//===================================


var $j = jQuery.noConflict();
var div;

$j(document).ready(function() {
    createStyles();
    var containerDiv = document.createElement('div');
    containerDiv.id = "dragContainer";
    $j("div.page-wrapper").css("margin-left", "250px").css("margin-right", "330px"); //Adjust dashboard page for custom div space
    $j("div.page-wrapper").append(containerDiv);

    div = document.createElement('div');
    div.id = "ggDL";
    $j("div#dragContainer").append(div);

    div2 = document.createElement('div');
    div2.className = "gginfo";
    if (localStorage.getItem("positionDownloadInfo")) {
        var position2 = $j.parseJSON(localStorage.getItem("positionDownloadInfo"));
        div2.style.top = position2.top + "px";
        div2.style.left = position2.left + "px";
    }
    $j("div#gginfo").draggable({
        opacity: 0.9,
        handle: "div",
        stop: function(event, ui){
            localStorage.setItem("positionDownloadInfo", JSON.stringify(ui.position));
        }
    });
    $j("div.gginfo").hover( function() {$j(this).css("cursor", "move");}, function(){ $j(this).css("cursor", "default"); });
    $j("div.page-wrapper").append(div2);

    if (localStorage.getItem("positionDownloadLocations")) {
        var position = $j.parseJSON(localStorage.getItem("positionDownloadLocations"));
        $j("div#dragContainer").css({
            top: position.top,
            left: position.left});
    }

    $j("div#dragContainer").draggable({
        opacity: 0.9,
        handle: "div",
        stop: function(event, ui){
            localStorage.setItem("positionDownloadLocations", JSON.stringify(ui.position));
        }
    });
    $j("div#ggDL").hover( function() {$j(this).css("cursor", "move");}, function(){ $j(this).css("cursor", "default"); });


    localStorage.removeItem('lastDownloads'); // remove cached locations response on page refresh
    localStorage.removeItem('lastEarnings'); // remove cached locations response on page refresh,
    localStorage.removeItem('lastSevenDays'); // remove cached locations response on page refresh
    localStorage.removeItem('positionImageInfo'); // remove cached locations response on page refresh

    showLocations();

    (makeOriginalDivsDraggable) && makeDivsDraggable();

    window.setInterval(showLocations,60000); // refresh every 60 seconds
    window.setInterval(retrieveEarnings,60000);
});


function makeDivsDraggable() {
    var divs = [ "div#download_map_column", "div#track_your_sets", "div#graph_column", "div#content_overview_column", "div#public_profile", "div.content_container" ];

    divs.forEach( function(entry) {
        $j(entry).draggable({
            stop: function(event, ui){
                localStorage.setItem(entry, JSON.stringify(ui.position));
            }
        }); // to hide them, use .hide() instead of draggable()

        if (localStorage.getItem(entry)) { 
            var position = $j.parseJSON(localStorage.getItem(entry));
            $j(entry).css('top', position.top + "px");
            $j(entry).css('left', position.left + "px");
        }
    }
                );
}


function existsInLocalStorage(key, data) {
    var thisResponseHash = CryptoJS.MD5(data).toString(CryptoJS.enc.Base64);
    if (localStorage.getItem(key) == thisResponseHash) {
        if (debug) { console.log("No change in " + key + ": " + thisResponseHash); };
        return true;
    }
    else {
        localStorage.setItem(key, thisResponseHash);
        if (debug) { console.log("Inserting into " + key + ": " + thisResponseHash); }
        return false;
    }
}

function showLocations() {


    $j.ajax({
        //url: window.location.protocol + '//submit.shutterstock.com/show_component.mhtml?component_path=download_map/recent_downloads.mh',
        url: window.location.protocol + '//submit.shutterstock.com/api/user/downloads/map',
        type: "get",
        dataType: "html",
        error: function (request, status, error) {
            //alert(request.responseText);
        },
        success: function( data ){
            if (existsInLocalStorage('lastDownloads', data)) {
                retrieveEarnings();
                $j("div.refreshCoords").text("Refresh");
                return true;
            }

            var coords = $j.parseJSON(data);
            localStorage.removeItem('lastSevenDays'); 

            div.innerHTML = "<span class=\"refreshCoords\">Refresh</span>";

            if (displayEarnings){
                div.innerHTML += "<H4>Earnings</h4>";
                retrieveLastWeekEarnings();
                div.innerHTML += "Last 7 days: <span id=\"last7\"></span>$<br />";
                div.innerHTML += "Today: <span id=\"today\"></span>$<br />";
                //      div.innerHTML += "Lifetime: <span id=\"lifetime\"></span>$<br />";
                //      div.innerHTML += "Unpaid: <span id=\"unpaid\"></span>$<br />";
            }

            div.innerHTML += "<h4>Download locations</h4>";

            $j.each(coords, function( ind, el ) {
                var id = el.media_id;
                var img = window.location.protocol + "//image.shutterstock.com/thumb_small/0/0/" + id + ".jpg";//el.thumb_url;
                var otime = parseIsoDatetime(el.time);
                var time = otime.getTime() + 25200000;
                var lat;
                var lon;
                var loc;
                var location = el.city + ", " + el.country;
                if (el.coordinates !== null) {
                    lat = el.coordinates[0];
                    lon = el.coordinates[1];

                }


                if (trackMySales) {
                    localStorage.setItem(id + "-" + time, JSON.stringify(el)); // save image info, key = (id-time_of_download);
                }

                if (debug) { console.log("Added " + id + "to local storage"); }

                // if it's footage, need to change thumbnail size; too bad i can't test it with 1 footage a century
                var footageWidth = "";
                if (el.media_type != "image") {
                    footageWidth = "width=\"100px\" height=\"59\" ";
                }

                div.innerHTML += "<span id='info-" + id + "-" + time + "' imageId='" + id + "' class='infoLinks'>" + id + "</div><br/>";

                div.innerHTML += "<a target=\"_new\" href=\"http://www.shutterstock.com/pic.mhtml?id=" + id + "\"><img " + footageWidth + "src=\"" + img + "\" /></a><br />";

                if (location) {
                    div.innerHTML +=  "<a class=\"location" + id +  "-" +  time + "\" target=\"_new\" href=\"" + googleMaps + lat + "+"+ lon + "\">"+location+"</a><br />";
                }
                else {
                    div.innerHTML += "Unknown, middle of Atlantic :)<br />";
                }

                var n =  new Date().getTimezoneOffset() / 60; // offset from GMT
                // taking only time from date - 6+n - NY time + offset from GMT gives local - works fine for me
                var t = new Date((time + (6+n) * 3600) *1000).toTimeString().split(" ")[0]; 
                if (displayRecentEarnings) {
                    div.innerHTML += "Earnings: <span id=\"earnings" + id + time + "\">N/A</span><br />";
                    if (debug) {console.log(time)};
                }
                //div.innerHTML += "Time: " + t + "<hr />";
                div.innerHTML += "Time: " + getMMDDYY(time) + "<hr />";
            });


            $j("span.refreshCoords").on("click", function() {
                $j("span.refreshCoords").text("Refreshing...");
                showLocations(); 
            });

            localStorage.removeItem('lastEarnings');
            retrieveEarnings();
            
            resetDivInfo();
            fixLinksinDailyStats();

        }
    });
}

function formatDate(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;
    var strTime = hours + ':' + minutes + ' ' + ampm;
    return date.getMonth()+1 + "/" + date.getDate() + "/" + date.getFullYear() + "  " + strTime;
}

function getMMDDYY(ticks) {

    var myticks = ticks;
    //myticks = myticks * 10000000;
    //myticks = myticks / 10000;
    var epochMicrotimeDiff = 2208988800000; //Jan 1, 1970
    var DateFormTicks = new Date(myticks);
    var offsetTimeZone = DateFormTicks.getTimezoneOffset();
    offsetTimeZone = (offsetTimeZone / 60) * -1;
    offsetTimeZone = (4 + offsetTimeZone) - offsetTimeZone; //Ticks from SS is Newyork time (GMT-4)
    DateFormTicks.setTime(DateFormTicks.getTime() + (offsetTimeZone*60*60*1000)); 

    return formatDate(DateFormTicks);
}

function retrieveLastWeekEarnings(){
    $j.ajax({
        url: window.location.protocol + '//submit.shutterstock.com/show_component.mhtml?component_path=mobile/comps/earnings_overview.mj',
        type: "get",
        dataType: "html",
        error: function (request, status, error) {
            console.log(request.responseText);
        },
        success: function( data ){
            if (existsInLocalStorage('lastSevenDays', data)) {
                retrieveEarnings();
                $j("div.refreshCoords").text("Refresh");
                return true;
            }
            var res = $j.parseJSON(data);  
            // moramo ovako jer je asinkrono. dok u divu ispise tekst, ovo jos nije stiglo sa servera
            if (res.last_7_days) {
                $j("span#last7").text(res.last_7_days);
            }
            if (res.day) {
                $j("span#today").text(res.day);
            }
            //      if (res.unpaid) {
            //          $j("span#unpaid").text(res.unpaid);
            //      }
            //      if (res.lifetime) {
            //          $j("span#lifetime").text(res.lifetime);
            //      }
        }  
    }); 
}
// retreive earnings for last 7 days for each image: http://submit.shutterstock.com/show_component.mhtml?component_path=mobile/comps/earnings_list.mj
// and put that info in the appropriate DIV

function retrieveEarnings(){
    if (displayRecentEarnings) {
        $j.ajax({
            url: window.location.protocol + '//submit.shutterstock.com/show_component.mhtml?component_path=mobile/comps/earnings_list.mj',
            type: "get",
            dataType: "html",
            error: function (request, status, error) {
                console.log("retrieveEarnings:" + request.responseText);
            },
            success: function( data ){

                if (existsInLocalStorage('lastEarnings', data)) {
                    $j("span.refreshCoords").text("Refresh");
                    return true;
                }

                var res = $j.parseJSON(data);  

                var day=0; // retrieve for today, will increase if <10 dls today
                var retrievedImages = 0; // count number of retrieved, stop at 10

                while (retrievedImages < 10) {
                    var downloads = res[day].downloads;
                    $j.each(downloads, function (ind, el) {
                        var imageID = el.photo_id;
                        var earnings = el.payout;
                        var date = el.download_date;
                        if (debug) {console.log("ID: " + imageID + ", Earnings: " + earnings + ", Date: " + date);}
                        $j("span#earnings" + imageID + date ).text(earnings + "$");
                        /* $j("#info-" + imageID + "-" + date).on('click', function() {
                            if (opened != imageID) {
                                GetImageData(imageID);
                                $j("div.gginfo").show();
                            } else {
                                console.log('test');
                            }
                            opened = imageID; // remember which image is still opened
                        });*/
                        retrievedImages++;
                        if (retrievedImages >= 10) return false;
                    });
                    day++;
                    if (debug) console.log(day, retrievedImages);
                }

            }
        });
    }
}


function fixLinksinDailyStats(){
    $j("span.infoLinks").each(function() {
        var ahref = $j(this).attr("imageId");
        if (ahref) {
            $j(this).on("click", function() {
                console.log(ahref);
                if (opened != ahref) {
                    GetImageData(ahref);
                    $j("div.gginfo").show();
                }
                opened = ahref; // remember which image is still opened
            } );
        }
    });
}


// following code created by https://gist.github.com/satinka/5479a93d389a07d41246

function ExtractLocation(details) { // created by https://gist.github.com/satinka/5479a93d389a07d41246
    var loc = "";
    var country = "";
    var locality = "";
    var admin_area1 = "";
    var admin_area2 = "";

    $j.each(details, function( ind, el ) {
        if ($j.inArray("country", el.types) != -1) 
            country = useShortCountryName ? el.short_name : el.long_name;
        if ($j.inArray("locality", el.types) != -1) 
            locality = el.long_name;
        if ($j.inArray("administrative_area_level_1", el.types) != -1) 
            admin_area1 = el.short_name;
        if ($j.inArray("administrative_area_level_2", el.types) != -1) 
            admin_area2 = el.long_name;
    });
    loc = loc + ((locality !== "") ? locality + ", " : "") +
        ((admin_area2 != "") ? admin_area2 + ", " : "") +
        ((admin_area1 != "") ? admin_area1 + ", " : "") +
        ((country !== "") ? country : "");
    return loc;
}

function createStyles() {
    var sheet = (function() {
        var style = document.createElement("style");
        style.appendChild(document.createTextNode(""));
        document.head.appendChild(style);
        return style.sheet;
    })(); 
    var refreshCoords = "cursor: hand; cursor: pointer; text-decoration: underline;";
    var infoLinks = "cursor: hand; cursor: pointer; text-decoration: underline;";

    var ggDL = "position: fixed; top: 60px; left: 50px; width: 200px; height: 95%; overflow: auto; z-index:3;" +
        "border: 1px solid #eeeeee; background-color: white; resize: both;" +
        "font-size: 11px;" +
        "padding: 2px 3px 0 5px;" + 
        "text-shadow: 0 0 5px #fff; text-align: left;";

    //   var map = "position: fixed; top: 60px; left: 320px; width: 1000px; height: 95%; overflow: auto; background-color: #eeeeee;";
    addCSSRule(sheet, "div#dragContainer", ggDL, 0);
    addCSSRule(sheet, "span.refreshCoords", refreshCoords, 0);
    addCSSRule(sheet, "span.infoLinks", infoLinks, 0);


    var resize = "max-width: 30%; max-height:30%;";
    var alink = "cursor: hand; cursor: pointer;";
    var closelink = "cursor: hand; cursor: pointer; text-decoration: underline; ";
    var gginfo = "position: fixed; top: 120px; right: 10px; border:4px solid #eeeeee;" +
        "width: 330px; max-height: 70%;" +
        "font-weight: normal;" +
        "resize: both;" +
        "padding: 10px 10px 10px 10px;" +
        "background-color: white;" +
        "opacity: 0.8;" +
        "overflow: auto;" +
        "font-size: 12px;";
    var datepick = "position: fixed; top: 60px; left: 15px; font-size: 12px; width: 300px";

    addCSSRule(sheet, "div.gginfo", gginfo, 0);
    addCSSRule(sheet, "span.closeInfo", closelink, 0);
    addCSSRule(sheet, "a.link:hover", alink, 0);
    addCSSRule(sheet, "img.resize", resize, 0);
    addCSSRule(sheet, "div#datepicker a", alink, 0);  // make pointer when hovering over linkable elements
    addCSSRule(sheet, "div#datepicker", datepick, 0);
}

function addCSSRule(sheet, selector, rules, index) {
    if("insertRule" in sheet) {
        sheet.insertRule(selector + "{" + rules + "}", index);
    }
    else if("addRule" in sheet) {
        sheet.addRule(selector, rules, index);
    }
}

function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}


function GetImageData(imageID) {

    console.log(imageID);

    div2.innerHTML = "<h4>Loading...</h4>";
    var d = new Date();
    var n = d.getTimezoneOffset() / 60;

    $j.ajax({
        url: window.location.protocol + '//submit.shutterstock.com/show_component.mhtml?component_path=mobile/comps/image_detail.mj&photo_id=' + imageID,
        type: "get",
        dataType: "html",
        cache: true,
        error: function (request, status, error) {
            console.log(request.responseText);
        },
        success: function( data ){
            var imageInfo = $j.parseJSON(data);

            if (imageInfo) {
                var downloads = imageInfo.latest_downloads;
                var keywords = imageInfo.keywords;
                var totals = imageInfo.totals;
                var today = totals.today;
                var all = totals.all_time;
                var table;
                div2.innerHTML = "<span class=\"closeInfo\">Close</span><br />";
                div2.innerHTML += "<h4>Image statistics</h4>";
                div2.innerHTML += "<a target=\"_new\" href=\"https://www.shutterstock.com/pic.mhtml?id=" + imageID + "\"><img align=\"right\" class=\"resize\" src=\"https:" + imageInfo.thumb_url + "\" /></a>";
                div2.innerHTML += "<h5> " + imageInfo.description + "</h5>";
                div2.innerHTML += "<b>Image ID:</b> <a target=\"_new\" href=\"https://www.shutterstock.com/pic.mhtml?id=" + imageID + "\">" + imageID + "</a><br />";

                var uploaded = new Date( ((imageInfo.uploaded_date/1000) + (6+n) * 3600)*1000).toDateString();
                var daysonline = Math.round((new Date().getTime() - imageInfo.uploaded_date) / (1000 * 24 * 60 * 60));
                div2.innerHTML += "<b>Uploaded on</b> " + uploaded  + " (" + daysonline + " days ago)<br /><br />";


                div2.innerHTML += "Earned <b>" + all.earnings + "$</b>";
                if (today.earnings > 0) {
                    div2.innerHTML += " (<b>" + today.earnings + "$</b> today)";
                }
                div2.innerHTML += "<br />";
                var s1 = (today.downloads) != 1 ? "s" : "";
                var s2 = (all.downloads) != 1 ? "s" : "";

                div2.innerHTML += "Downloaded <b>" + all.downloads + " time" + s2;
                if (today.downloads > 0) {
                    div2.innerHTML += " (<b>" + today.downloads + " time" + s1 + "</b> today)";
                }
                div2.innerHTML += "<br />";

                if (all.downloads > 0) {
                    var rpd = (all.earnings / all.downloads).toFixed(2);
                    div2.innerHTML += "Return per download: <b>" + rpd + "$</b><br />";
                }
                var editURL = window.location.protocol + "//submit.shutterstock.com/edit_media.mhtml?type=photos&approved=1&id=" + imageID;
                div2.innerHTML += "<a href=\"" + editURL + "\" target=\"_new\">Edit title and keywords</a> (opens new window)<br/>";

                div2.innerHTML += "<br /><a target=\"_new\" href =\"" + googleSearch + "http:" + imageInfo.thumb_url + "\">Find image in use via Google Images</a><br />";

                if (keywords.length > 0) {
                    div2.innerHTML += "<br /><b>Keywords used to download image:</b><br />";
                    table = "<table  width=\"200px\">";
                    table += "<thead><th align=\"right\">Keyword</th><th align=\"right\">% used</th></thead><tbody>";
                    keywords.forEach(function(kw) { 
                        table += "<tr><td align=\"right\">" + kw.keyword + "</td><td align=\"right\">" + parseFloat(kw.percentage).toFixed(2) + "</td></tr>";
                    });
                    table += "</tbody></table>";
                    div2.innerHTML += table;
                }
                else {
                    div2.innerHTML += "<br /><b>No keyword info available.</b><br />";
                }

                if (downloads.length > 0) {
                    div2.innerHTML += "<br /><b>Latest downloads</b> (max 20 or max last 365 days):</b><br />";
                    table = "<table  width=\"300px\">";
                    table += "<thead><th align=\"left\">Date</th><th align=\"right\">Earnings</th></thead><tbody>";
                    downloads.forEach(function(arg) { 
                        var date = new Date ( ((arg.date_time/1000) + (6+n) * 3600)*1000).toUTCString().toLocaleString();
                        table += "<tr><td align=\"left\">" + date + "</td><td align=\"right\">" + arg.amount + "</td></tr>";
                    });
                    table += "</tbody></table><br /";
                    div2.innerHTML += table;
                }
                else
                {
                    div2.innerHTML += "<br /><b>No downloads in the last 365 days.</b><br />";
                }
            }

            $j("span.closeInfo").on("click", function(){ 
                //  $j("div.gginfo").hide();      // i'd rather keep the info on the screen than hide the div
                resetDivInfo();
                opened = 0;
            });
        }
    });
}

function resetDivInfo(){
    $j("div.gginfo").html("<b>Click on image ID to show image info.</b>");
    return;
}

function parseIsoDatetime(dtstr) {
    var dt = dtstr.split(/[: T-]/).map(parseFloat);
    return new Date(dt[0], dt[1] - 1, dt[2], dt[3] || 0, dt[4] || 0, dt[5] || 0, 0);
}