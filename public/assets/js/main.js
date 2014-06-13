var map, in_bounds, drawn, filter_selections = {}, loaded_at = new Date();
var geoJsonLayers = {}, layersData = {}

var AQE = (function ( $ ) {
  "use strict";

  // set up icons for map
  var eggIconURL = '/assets/img/egg-icon.png';
  var eggIcon = L.icon({
      iconUrl: eggIconURL,
      iconSize: [19, 20], // size of the icon
      className: 'egg-icon'
  });
  var aqsIconURL = '/assets/img/blue-dot_15.png'
  var aqsIcon = L.icon({
      iconUrl: aqsIconURL,
      iconSize: [15, 15], // size of the icon
  });
  var schoolIconURL = '/assets/img/blackboard.png'
  var schoolIcon = L.icon({
      iconUrl: schoolIconURL,
      iconSize: [17, 17], // size of the icon
  });

  var defaultIconURL = '/vendor/leaflet-0.8-dev-06062014/images/marker-icon.png'
  var defaultIcon = L.icon({
    iconUrl: defaultIconURL,
    iconSize: [12, 20], // size of the icon
  });


  var heatmapIconURL = '/assets/img/heatmap_legend.png'

  // OpenWeatherMap Layers
  var clouds_layer = L.OWM.clouds({opacity: 0.8, legendImagePath: 'files/NT2.png'});
  var precipitation_layer = L.OWM.precipitation( {opacity: 0.5} );
  var rain_layer = L.OWM.rain({opacity: 0.5});
  var snow_layer = L.OWM.snow({opacity: 0.5});
  var pressure_layer = L.OWM.pressure({opacity: 0.4});
  var temp_layer = L.OWM.temperature({opacity: 0.5});
  var wind_layer = L.OWM.wind({opacity: 0.5});

  var groupedOverlays = {
    "OpenWeatherMap": {
      "Clouds": clouds_layer,
      "Precipiration": precipitation_layer,
      "Rain": rain_layer,
      "Snow": snow_layer,
      "Pressure": pressure_layer,
      "Temperature": temp_layer,
      "Wind": wind_layer
    }
  };

  initialize()

  function initialize() {
    // load feeds and then initialize map and add the markers
    if($(".map").length >= 1){
      // set up leaflet map
      map = L.map('map_canvas', {scrollWheelZoom: false, loadingControl: true, layers: []})
      map.fireEvent('dataloading')
      map.setView([38.22847167526397, -85.76099395751953], 11); // louisville
      var hash = new L.Hash(map);
    
      var drawControl = new L.Control.Draw({ draw: { polyline: false, marker: false }});
      map.addControl(drawControl);

      L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
          maxZoom: 18
      }).addTo(map);
      L.control.groupedLayers([], groupedOverlays).addTo(map);
      L.control.locate({locateOptions: {maxZoom: 9}}).addTo(map);
      L.control.fullscreen().addTo(map);

      map.on('moveend', function (eventLayer) {
        var map_center = map.getCenter()
        $("#home-map-aqis-container").html("")
        $.getJSON("/aqs/forecast.json?lat="+map_center.lat+"&lon="+map_center.lng, formatForecastDetails)
      })
      map.fireEvent('moveend')

      // if on an site's page, zoom in close to the site
      if ( $(".dashboard-map").length && feed_location) {
        map.setView(feed_location,9)
      }

      $.each(dataset_keys, function(n,key){
        if($(".filter-"+key+":checked").length > 0){
          $.getJSON("/ckan_proxy/"+key+".geojson", function(data){
            layersData[key] = data
            update_map(key)
          })        
        }
      })

      map.on('draw:created', function (e) {
          if(typeof(drawn) != "undefined"){map.removeLayer(drawn)} // remove previously drawn item
          in_bounds = {} // reset in_bounds away

          var type = e.layerType,
              layer = e.layer;          
          drawn = layer

          $.each(Object.keys(geoJsonLayers), function(n,type){
            $.each(geoJsonLayers[type].getLayers(), function(n,item){
              var layer_in_bounds = drawn.getBounds().contains(item.getLatLng())
              if(layer_in_bounds){ 
                if(typeof(in_bounds[item.ref.type]) == "undefined"){ in_bounds[item.ref.type] = [] }
                in_bounds[item.ref.type].push(item.ref.id)
              }
            })
          })

          var form = document.createElement("form");
          form.action = "/compare";
          form.method = "post"
          form.target = "_blank"
          $.each(in_bounds, function(type,ids){
            var input = document.createElement("input");
            input.name = type;
            input.value = ids.join(",");
            form.appendChild(input);
          })
          document.body.appendChild(form);
          form.submit();

          map.addLayer(layer);
      });
    }

    // if on egg dashboard
    if($("#dashboard-egg-chart").length){
      graphEggHistoricalData();
    }

    // if on AQS dashboard
    if($("#dashboard-aqs-chart").length){
      graphAQSHistoricalData();
    }

    $("tr[data-sensor-id]").each(function(n,row){
      var type = $(row).data("sensor-type")
      var id = $(row).data("sensor-id")
      $.getJSON("/"+type+"/"+id+".json", function(data){
        $(row).find(".sensor-title").html(data.site_name || data.title)
        $(row).find(".sensor-description").html(data.msa_name || data.cmsa_name || data.description)
        var html = formatSensorDetails(data)
        $(row).children('td').last().html(html)
      })
    })

    $(".momentify").each(function(n,item){
      var original = $(item).html()
      var from_now = moment(original).fromNow()
      $(item).html("<abbr title='"+original+"'>"+from_now+"</abbr>")
    })

    $( ".submit-map-filters" ).on('click',function( event ) {
      event.preventDefault();
      $.each(dataset_keys, function(n,key){
        if($(".filter-"+key+":checked").length > 0){
          if(layersData[key] == undefined){
            $.getJSON("/ckan_proxy/"+key+".geojson", function(data){
              layersData[key] = data
              update_map(key)
            })
          } else {
            update_map(key)
          }
        } else {
          update_map(key)
        }
      })
    });

  }

  function formatForecastDetails(data){
    var html = ""
    $.each(data, function(n,item){
      html += "<div class='alert' style='margin-bottom:10px; padding: 5px; background-color:"+item.aqi_cat.color+"; color:"+item.aqi_cat.font+"'>"
      html += "<strong>AQI category "+item.Category.Name.toLowerCase()+ " forecasted for "+item.ParameterName+" on "+item.DateForecast+" in/around "+item.ReportingArea+"</strong>"
      html += "</div> "
    })
    if(html == ""){html = "<div class='alert alert-info'>AirNowAPI.org doesnt have any AQI forecasts within 50 miles of the map center. Try panning to a different area.</div>"}
    $("#home-map-aqis-container").html(html)
  }

  function formatSensorDetails(data){
    var html = ""
    if(data.prevailing_aqi){
      html += " <div class='alert' style='padding: 5px; background-color:"+data.prevailing_aqi.aqi_cat.color+"; color:"+data.prevailing_aqi.aqi_cat.font+"'>This location's air is "+data.prevailing_aqi.aqi_cat.name+"</div> "
    }
    var sensor_table = "<table class='table table-striped'><tr><th>Sensor</th><th>Latest Reading</th></tr></tr>"
    html += sensor_table
    $.each(data.datastreams, function(name,item){
      if(item){
        html += "<tr>"
        html += "<td>"+name+"</td>"
        html += "<td>"
        if(item.computed_aqi > 0){
          html += " <span class='alert' style='padding: 2px; background-color:"+item.aqi_cat.color+"; color:"+item.aqi_cat.font+"'>"+item.aqi_cat.name+" (AQI = "+item.computed_aqi+")</span> "
        }
        html += " " + item.value + " " + item.unit
        if(item.datetime){ html += " (" + moment(item.datetime+"Z").fromNow() +  ")"  }
        else if(item.time){ html += " (" + moment(item.date + " " + item.time).fromNow() +  ")" }
        else {html += " (" + moment(item.date ).fromNow() +  ")" }
          html += "</td>"
        html += "</tr>"
      }        
    })
    html += "</table>"
    if(html == sensor_table+"</table>"){html = "<em>No recent data available</em>"}
    return html
  }

  function onEachFeature(feature, layer) {
    var item = feature.properties
    layer.ref = {type: item.type, id: item.id}
    if(item.type == "aqe"){
      layer.setIcon(eggIcon)
      var html = "<div><h4>Air Quality Egg Details</h4><table class='table table-striped' data-feed_id='"+item.id+"'>"
      html += "<tr><td>Name </td><td> <a href='/egg/"+item.id+"'><strong>"+item.title+"<strong></a></td></tr>"
      html += "<tr><td>Description </td><td> "+item.description+"</td></tr>"
      html += "<tr><td>Position </td><td> "+item.location_exposure+" @ "+item.location_ele+" elevation</td></tr>"
      html += "<tr><td>Status </td><td> "+item.status+"</td></tr>"
      html += "<tr><td>Created </td><td> "+moment(item.created+"Z").fromNow()+"</td></tr>"
      if(item.last_datapoint){html += "<tr><td>Last data point </td><td> "+moment(item.last_datapoint+"Z").fromNow()+" ("+item.last_datapoint+")</td></tr>"}
      html += "</table>"
      html += "<div id='egg_"+item.id+"'></div>"
      html += "<p style='text-align: right'><a href='/egg/"+item.id+"'>More about this egg site including historical graphs →</a></p>"
      html += "</div>"
      layer.bindPopup(html)
      layer.on('click', onEggMapMarkerClick); 
    }
    else if(item.type == "aqs"){
      layer.setIcon(aqsIcon)
      var html = "<div><h4>AirNow AQS Site Details</h4><table class='table table-striped' data-aqs_id='"+item.aqs_id+"'>"
      html += "<tr><td>Site</td><td> <a href='/aqs/"+item.aqs_id+"'><strong>"+item.site_name+" / "+item.aqs_id+"</strong></a></td></tr>"
      html += "<tr><td>Agency</td><td>"+item.agency_name+"</td></tr>"
      html += "<tr><td>Position</td><td> "+item.elevation+" elevation</td></tr>"
      if(item.msa_name){html += "<tr><td>MSA</td><td> "+item.msa_name+"</td></tr>"}
      if(item.cmsa_name){html += "<tr><td>CMSA</td><td> "+item.cmsa_name+"</td></tr>"}
      html += "<tr><td>County</td><td>"+item.county_name+"</td></tr>"
      html += "<tr><td>Status</td><td>"+item.status+"</td></tr>"
      html += "</table>"
      html += "<div id='aqs_"+item.aqs_id+"'></div>"
      html += "<p style='text-align: right'><a href='/aqs/"+item.aqs_id+"'>More about this AQS site including historical graphs →</a></p>"
      html += "</div>"
      layer.bindPopup(html)
      layer.on('click', onAQSSiteMapMarkerClick); 
    }
    else if(item.type == "jeffschools"){
      layer.setIcon(schoolIcon)
      var html = "<div><h4>School Details</h4>"
      html += "<table class='table table-striped' data-school_id='"+item.NCESSchoolID+"'>"
      html += "<tr><td>School Name </td><td>"+item.SchoolName+" </td></tr>"
      html += "<tr><td>Grades </td><td>"+item.LowGrade+" through "+item.HighGrade+" </td></tr>"
      html += "<tr><td>Phone Number </td><td>"+item.Phone+" </td></tr>"
      html += "<tr><td># Students </td><td>"+item["Students*"]+" </td></tr>"
      html += "<tr><td>Student-Teacher Ratio </td><td>"+item["StudentTeacherRatio*"]+" </td></tr>"
      html += "<tr><td>Title I School (Wide)? </td><td>"+item["TitleISchool*"]+" ("+item["Title1SchoolWide*"]+") </td></tr>"
      html += "<tr><td>Magnet School? </td><td>"+item["Magnet*"]+" </td></tr>"
      html += "<tr><td>School District </td><td>"+item.District+" </td></tr>"
      html += "<tr><td>NCES School ID </td><td>"+item.NCESDistrictID+" </td></tr>"
      html += "<tr><td>State School ID </td><td>"+item.StateSchoolID+" </td></tr>"
      html += "</table>" // <hr />"
      html += "<p style='font-size:80%'>From CCD public school data 2011-2012, 2011-2012 school years. To download full CCD datasets, please go to <a href='http://nces.ed.gov/ccd' target='blank'>the CCD home page</a>."
      html += "</div>"
      layer.bindPopup(html)
    }
    else if(item.type == "propaqe"){
      layer.setIcon(L.divIcon({className: 'leaflet-div-icon leaflet-div-icon-propaqe', html:item.group_code}))        
      var html = "<div><h4>Proposed Egg Location Details</h4>"
      html += "<table class='table table-striped' data-object_id='"+item.object_id+"'>"
      html += "<tr><td>Object ID</td><td>"+item.object_id+" </td></tr>"
      html += "<tr><td>Group Code </td><td>"+item.group_code+"</td></tr>"
      html += "<tr><td>Coordinates </td><td>"+item.lat+", "+item.lon+"</td></tr>"
      html += "</table>" 
      html += "</div>"
      layer.bindPopup(html)
    }
    else if(item.type == "bike"){
      layer.setIcon(L.divIcon({className: 'leaflet-div-icon leaflet-div-icon-bike', html:item.bike_id}))        
      var html = "<div><h4>Bike Sensor Details</h4>"
      html += "<table class='table table-striped' data-bike_id='"+item.bike_id+"'>"
      html += "<tr><td>Bike ID</td><td>"+item.bike_id+" </td></tr>"
      html += "<tr><td>Time</td><td>"+item.datetime+" </td></tr>"
      html += "<tr><td>Sensor </td><td>"+item.parameter+"</td></tr>"
      html += "<tr><td>Value </td><td>"+item.value+"</td></tr>"
      html += "<tr><td>Units </td><td>"+item.unit+"</td></tr>"
      html += "<tr><td>Coordinates </td><td>"+item.lat+", "+item.lon+"</td></tr>"
      html += "</table>" 
      html += "</div>"
      layer.bindPopup(html)
    }
    else if(item.type == "parks"){
      layer.setIcon(defaultIcon)
      var html = "<div><h4>Park Details</h4>"
      html += "<table class='table table-striped' data-bike_id='"+item.ParkKey+"'>"
      html += "<tr><td>Park Key</td><td>"+item.ParkKey+" </td></tr>"
      html += "<tr><td>Name</td><td><a href='"+item.Url+"' target='blank'>"+item.DisplayName+"</a> </td></tr>"
      html += "<tr><td>Amenities</td><td>"+item.Amenities.join(", ")+" </td></tr>"
      html += "<tr><td>Telephone</td><td>"+item.Telephone+" </td></tr>"
      html += "<tr><td>Address</td><td>"+item.StreetAddr+" </td></tr>"
      html += "<tr><td>City</td><td>"+item.City+" </td></tr>"
      html += "<tr><td>State</td><td>"+item.State+" </td></tr>"
      html += "<tr><td>Zip</td><td>"+item.ZipCode+" </td></tr>"
      html += "</table>" 
      html += "</div>"
      layer.bindPopup(html)
    }
    else if(item.type == "food"){
      layer.setIcon(defaultIcon)
      var html = "<div><h4>Inspected Establishment Details</h4>"
      html += "<table class='table table-striped' data-bike_id='"+item.EstablishmentID+"'>"
      html += "<tr><td>Establishment ID</td><td>"+item.EstablishmentID+" </td></tr>"
      html += "<tr><td>Name</td><td>"+item.EstablishmentName+"</a> </td></tr>"
      html += "<tr><td>Inspection Scores</td><td>"+item.Inspections.join(", ")+" </td></tr>"
      html += "<tr><td>Address</td><td>"+item.Address+" </td></tr>"
      html += "<tr><td>City</td><td>"+item.City+" </td></tr>"
      html += "<tr><td>State</td><td>"+item.State+" </td></tr>"
      html += "<tr><td>Zip</td><td>"+item.Zip+" </td></tr>"
      html += "</table>" 
      html += "</div>"
      layer.bindPopup(html)
    } else {
      var html = "<div><h4>"+item.type.toUpperCase()+" ID #"+item.id+"</h4></div>"
      layer.bindPopup(html)
    }


  }

  function filterFeatures(feature, layer) {
    var item = feature.properties
    var show = true

    if(item.type == "aqe"){
      // indoor/outdoor ===========
      if(filter_selections["outdoor-eggs"] == "true" && item.location_exposure == "outdoor"){ show = true }
      else if(filter_selections["indoor-eggs"] == "true" && item.location_exposure == "indoor"){ show = true }
      else{ show = false }

      // time basis ===============
      if(item.last_datapoint){ var last_datapoint = new Date(item.last_datapoint+"Z") }
      else { var last_datapoint = new Date(0,0,0) }

      if(show == true && filter_selections["last-datapoint-not-within-168-hours"] == "true"){
        var x_hours_ago = new Date().setHours(loaded_at.getHours()-168) 
        if(last_datapoint >= x_hours_ago){ show = false }
        else {show = true}
      }
      if(show == true && filter_selections["last-datapoint-within-168-hours"] == "true"){
        var x_hours_ago = new Date().setHours(loaded_at.getHours()-168) 
        if(last_datapoint >= x_hours_ago){ show = true }
        else {show = false}
      }
      if(show == true && filter_selections["last-datapoint-within-24-hours"] == "true"){
        var x_hours_ago = new Date().setHours(loaded_at.getHours()-24) 
        if(last_datapoint >= x_hours_ago){ show = true }
        else {show = false}
      }
      if(show == true && filter_selections["last-datapoint-within-6-hours"] == "true"){
        var x_hours_ago = new Date().setHours(loaded_at.getHours()-6) 
        if(last_datapoint >= x_hours_ago){ show = true }
        else {show = false}
      }
    }
    else if(item.type == "aqs"){
      if(filter_selections["active-sites"] == "true" && item.status == "Active"){ show = true }
      else{ show = false }
    }
    else if(item.type == "jeffschools"){
      if(filter_selections["jeffschools"] == "true" && item.District == "JEFFERSONCOUNTY"){ show = true }
      else{ show = false }
    }
    else if(item.type == "parks"){
      if(filter_selections["parks"] == "true"){ show = true }
      else{ show = false }
    }
    else if(item.type == "food"){
      if(filter_selections["food"] == "true"){ show = true }
      else{ show = false }
    }
    else if(item.type == "propaqe"){
      if(filter_selections["propaqe-group-1"] == "true" && item.group_code == "1"){ show = true }
      else if(filter_selections["propaqe-group-2"] == "true" && item.group_code == "2"){ show = true }
      else if(filter_selections["propaqe-group-3"] == "true" && item.group_code == "3"){ show = true }
      else{ show = false }
    }
    else if(item.type == "bike"){
      if(filter_selections["bike-O3"] == "true" && item.parameter == "O3"){ show = true }
      else if(filter_selections["bike-CO"] == "true" && item.parameter == "CO"){ show = true }
      else if(filter_selections["bike-NO2"] == "true" && item.parameter == "NO2"){ show = true }
      else if(filter_selections["bike-VOC"] == "true" && item.parameter == "VOC"){ show = true }
      else if(filter_selections["bike-Particulate"] == "true" && item.parameter == "PARTICULATE"){ show = true }
      else if(filter_selections["bike-RHUM"] == "true" && item.parameter == "RHUM"){ show = true }
      else if(filter_selections["bike-TEMP"] == "true" && item.parameter == "TEMP"){ show = true }
      else{ show = false }
    } else {
      show = false
    }
    return show
  }

  function update_filters(){
    // set filter selections to be used by filterFeatures
    // aqe specific
    filter_selections["indoor-eggs"] = $('input.filter-indoor-eggs:checked').val()
    filter_selections["outdoor-eggs"] = $('input.filter-outdoor-eggs:checked').val()
    filter_selections["last-datapoint-within-6-hours"] = $('input.filter-last-datapoint-within-6-hours:checked').val()
    filter_selections["last-datapoint-within-24-hours"] = $('input.filter-last-datapoint-within-24-hours:checked').val()
    filter_selections["last-datapoint-within-168-hours"] = $('input.filter-last-datapoint-within-168-hours:checked').val()
    filter_selections["last-datapoint-not-within-168-hours"] = $('input.filter-last-datapoint-not-within-168-hours:checked').val()
    // propaqe
    filter_selections["propaqe-group-1"] = $('input.filter-propaqe-group-1:checked').val()
    filter_selections["propaqe-group-2"] = $('input.filter-propaqe-group-2:checked').val()
    filter_selections["propaqe-group-3"] = $('input.filter-propaqe-group-3:checked').val()
    // aqs specific
    filter_selections["active-sites"] = $('input.filter-active-sites:checked').val()
    // jeffschools specific
    filter_selections["jeffschools"] = $('input.filter-jeffschools:checked').val()
    // portal.louisvilleky.gov
    filter_selections["food"] = $('input.filter-food:checked').val()
    filter_selections["parks"] = $('input.filter-parks:checked').val()
    // durham labs
    filter_selections["bike-O3"] = $('input.filter-bike-O3:checked').val()
    filter_selections["bike-CO"] = $('input.filter-bike-CO:checked').val()
    filter_selections["bike-NO2"] = $('input.filter-bike-NO2:checked').val()
    filter_selections["bike-VOC"] = $('input.filter-bike-VOC:checked').val()
    filter_selections["bike-Particulate"] = $('input.filter-bike-Particulate:checked').val()
    filter_selections["bike-TEMP"] = $('input.filter-bike-TEMP:checked').val()
    filter_selections["bike-RHUM"] = $('input.filter-bike-RHUM:checked').val()
  }

  function update_map(key){
    if(typeof(geoJsonLayers[key]) != "undefined"){map.removeLayer(geoJsonLayers[key]);}    // clear all markers
    update_filters()

    geoJsonLayers[key] = L.geoJson(layersData[key], {
      onEachFeature: onEachFeature,
      filter: filterFeatures
    }).addTo(map);

    console.log(key+' - updated map')
    map.fireEvent('dataload')

  }

  function onEggMapMarkerClick(e){
    var feed_id = $(".leaflet-popup-content .table").first().data("feed_id")
    if(typeof(ga)!="undefined"){ ga('send', 'event', 'egg_'+feed_id, 'click', 'egg_on_map', 1); }
    $.getJSON("/egg/"+feed_id+".json", function(data){
      var html = ""
      var html = formatSensorDetails(data)
      $("#egg_"+feed_id).append(html)
    })
  }

  function onAQSSiteMapMarkerClick(e){
    var aqs_id = $(".leaflet-popup-content .table").first().data("aqs_id")
    if(typeof(ga)!="undefined"){ ga('send', 'event', 'aqs_'+aqs_id, 'click', 'aqs_on_map', 1); }
    
    $.getJSON("/aqs/"+aqs_id+".json", function(data){
      var html = formatSensorDetails(data)
      $("#aqs_"+aqs_id).append(html)
    })
  }

  function graphEggHistoricalData(){
    // create skeleton chart

    $.getJSON(location.pathname+".json?include_recent_history=1", function(data){

      $.each(data.recent_history, function(i,series){
        if(series.name.match(/ppb/gi)){
          series.yAxis = 0
        } else {
          series.yAxis = 1
        }
      })

      $('#dashboard-egg-chart').highcharts({
          chart: {
              type: 'spline',
              zoomType: 'xy',
          },
          credits: { enabled: false }, 
          title: { text: "This Egg's Datastreams" },
          xAxis: { type: 'datetime' },
          yAxis: [
            { title: { text: 'ppb (parts per billion)'}, min: 0},
            { title: {text: ''}, min: 0, opposite: true }
          ],
          tooltip: {
            formatter: function(){
              var time = moment(this.x)
              var series_label = this.series.name.replace(/ \(.+\)/g,"")
              var series_unit = this.series.name.replace(/.+\ \((.+)\)/,"$1")
              return ''+time.format("MMM D, YYYY [at] h:mm a ([GMT] Z)")+' ('+time.fromNow()+')<br />'+'<b>'+ series_label +':</b> '+this.y+' '+series_unit;
            }
          },
          series: data.recent_history
      });

    })

  }

  function graphAQSHistoricalData(){
    // create skeleton chart

    $.getJSON(location.pathname+".json?include_recent_history=1", function(data){

      $.each(data.recent_history, function(i,series){
        if(series.name.match(/ppb/gi)){
          series.yAxis = 0
        } else {
          series.yAxis = 1
        }
      })

      $('#dashboard-aqs-chart').highcharts({
          chart: {
              type: 'spline',
              zoomType: 'xy',
          },
          credits: { enabled: false }, 
          title: { text: "This AQS Site's Datastreams" },
          xAxis: { type: 'datetime' },
          yAxis: [
            { title: { text: 'ppb (parts per billion)'}, min: 0},
            { title: {text: ''}, min: 0, opposite: true }
          ],
          tooltip: {
            formatter: function(){
              var time = moment(this.x)
              var series_label = this.series.name.replace(/ \(.+\)/g,"")
              var series_unit = this.series.name.replace(/.+\ \((.+)\)/,"$1")
              return ''+time.format("MMM D, YYYY [at] h:mm a ([GMT] Z)")+' ('+time.fromNow()+')<br />'+'<b>'+ series_label +':</b> '+this.y+' '+series_unit;
            }
          },
          series: data.recent_history
      });

    })

  }

  // function addAQIGauges(){
  //   $(".current-value-gauge").each(function(n,span){
  //     var value = $(span).data("aqi-value")
  //     var gauge_id = $(span).attr("id")
  //     if(value > 0){
  //       $('#'+gauge_id).highcharts({
  //               chart: {
  //                   type: 'gauge',
  //                   plotBorderWidth: 0,
  //                   plotShadow: false,
  //                   backgroundColor:'rgba(255, 255, 255, 0.002)',
  //                   marginLeft:-55
  //               },
  //               credits: { enabled: false },
  //               exporting: { enabled: false },
  //               title: { text: ''},
  //               subtitle: { text: 'AQI:', align: 'left', floating: true, x:-10, y:5},
  //               pane: {
  //                   startAngle: -90,
  //                   endAngle: 90,
  //                   background: null
  //               },
  //               plotOptions: {
  //                   gauge: {
  //                       dataLabels: { enabled: false },
  //                       dial: { radius: '80%' }
  //                   }
  //               },
  //               yAxis: {
  //                   min: 0,
  //                   max: 500,
  //                   minorTickInterval: 'auto',
  //                   minorTickWidth: 0,
  //                   minorTickLength: 10,
  //                   minorTickPosition: 'inside',
  //                   minorTickColor: '#666',

  //                   tickPixelInterval: 30,
  //                   tickWidth: 2,
  //                   tickPosition: 'inside',
  //                   tickLength: 10,
  //                   tickColor: '#666',
  //                   labels: {
  //                       step: 5,
  //                       rotation: 'auto'
  //                   },
  //                   title: { text: '' },
  //                   plotBands: [{
  //                       from: 0,
  //                       to: 50,
  //                       color: '#00E000'
  //                   }, {
  //                       from: 51,
  //                       to: 100,
  //                       color: '#FFFF00'
  //                   }, {
  //                       from: 101,
  //                       to: 150,
  //                       color: '#FF7E00'
  //                   }, {
  //                       from: 151,
  //                       to: 200,
  //                       color: '#FF0000'
  //                   }, {
  //                       from: 201,
  //                       to: 300,
  //                       color: '#99004C'
  //                   }, {
  //                       from: 301,
  //                       to: 500,
  //                       color: '#4C0026'
  //                   }]
  //               },
  //               tooltip: {
  //                 formatter: function(){
  //                   return 'AQI = '+this.point.y;
  //                 }
  //               },

  //               series: [{
  //                   name: 'AQI',
  //                   data: [{y: value}],
  //               }]

  //           },
  //           function () {}
  //       );

  //     }
  //   })
  // }

})( jQuery );