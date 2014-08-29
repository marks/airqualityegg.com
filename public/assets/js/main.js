var map, in_bounds, drawn, filter_selections = {}, loaded_at = new Date();
var geoJsonLayers = {}, layersData = {}

var AQE = (function ( $ ) {
  "use strict";

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
  var famallergyIconURL = '/assets/img/famallergy.png'
  var famallergyIcon = L.icon({
      iconUrl: famallergyIconURL,
      iconSize: [17, 17], // size of the icon
  });
  var nursinghomeIconURL = '/assets/img/nursing_home_icon.png'
  var nursinghomeIcon = L.icon({
      iconUrl: nursinghomeIconURL,
      iconSize: [30, 30], // size of the icon
  });
  var foodIconURL = '/assets/img/fastfood_icon.png'
  var foodIcon = L.icon({
      iconUrl: foodIconURL,
      iconSize: [30, 30], // size of the icon
  });
  var parkIconURL = '/assets/img/urbanpark_icon.png'
  var parkIcon = L.icon({
      iconUrl: parkIconURL,
      iconSize: [30, 30], // size of the icon
  });

  var weatherStationIconURL = '/assets/img/weather_station_icon.png'
  var weatherStationIcon = L.icon({
      iconUrl: weatherStationIconURL,
      iconSize: [30, 30], // size of the icon
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
    "Census Data from JusticeMap.org":{},
    "Open Weather Map": {
      "Clouds": clouds_layer,
      "Precipiration": precipitation_layer,
      "Rain": rain_layer,
      "Snow": snow_layer,
      "Pressure": pressure_layer,
      "Temperature": temp_layer,
      "Wind": wind_layer
    },
    "Esri ArcGIS Layers":{}
  };


  groupedOverlays["Esri ArcGIS Layers"]["USGS USA Soil Survey"] = new L.esri.tiledMapLayer(
    "http://server.arcgisonline.com/ArcGIS/rest/services/Specialty/Soil_Survey_Map/MapServer",
    {opacity: 0.45, attribution:"<a href='http://www.arcgis.com/home/item.html?id=204d94c9b1374de9a21574c9efa31164' target='blank'>USA Soil Survey via ArcGIS MapServer</a>"}
  )

  groupedOverlays["Esri ArcGIS Layers"]["USA Median Age from 2012 US Census"] = new L.esri.tiledMapLayer(
    "http://server.arcgisonline.com/arcgis/rest/services/Demographics/USA_Median_Age/MapServer",
    {opacity: 0.45, attribution:"<a href='http://www.arcgis.com/home/item.html?id=fce0ca8972ae4268bc4a69443b8d1ef5' target='blank'>USA Median Age using 2010 US Census via ArcGIS MapServer</a>"}
  )

  groupedOverlays["Esri ArcGIS Layers"]["Esri USA Tapestry"] = new L.esri.tiledMapLayer(
    "http://server.arcgisonline.com/arcgis/rest/services/Demographics/USA_Tapestry/MapServer",
    {opacity: 0.45, attribution:"<a href='http://www.arcgis.com/home/item.html?id=f5c23594330d431aa5d9a27abb90296d' target='blank'>Esri USA Tapestry via ArcGIS MapServer</a>"}
  )

  var legend = L.control({position: 'bottomright'});
  var justiceMapAttribution = '<a target=blank href="http://census.gov">Demographics from 2010 US Census & 2011 American Community Survey (5 yr summary)</a> via <a target=blank href="http://justicemap.org">JusticeMap.org</a>'
  groupedOverlays["Census Data from JusticeMap.org"] = {}
  $.each(["asian","black","hispanic","indian","multi","white","nonwhite","other","income"],function(n,layer_name){
    groupedOverlays["Census Data from JusticeMap.org"][toTitleCase(layer_name)+" by Census Tract"] = L.tileLayer(
      'http://www.justicemap.org/tile/{size}/{layer_name}/{z}/{x}/{y}.png',
      {size: 'tract', layer_name: layer_name, opacity: 0.45, attribution: justiceMapAttribution})
  })

  initialize()

  function initialize() {
    // load feeds and then initialize map and add the markers
    if($(".map").length >= 1){
      // set up leaflet map
      map = L.map('map_canvas', {scrollWheelZoom: false, loadingControl: true, layers: []}) // propellerhealth_layer
      // map.fireEvent('dataloading')

      if(location.hash == ""){
        map.setView(focus_city.latlon, focus_city.zoom)
      } else {
        var hash_info = location.hash.replace('#','').split("/")
        map.setView([hash_info[1],hash_info[2]], hash_info[0])
      }

      setTimeout(function(){
        var hash = new L.Hash(map);
      }, 500);

      var drawControl = new L.Control.Draw({ draw: { polyline: false, marker: false }});
      map.addControl(drawControl);

      L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data © <a target=blank href="http://openstreetmap.org">OpenStreetMap</a> contributors',
          maxZoom: 18
      }).addTo(map);
      L.control.groupedLayers([], groupedOverlays).addTo(map);
      L.control.locate({locateOptions: {maxZoom: 9}}).addTo(map);
      L.control.fullscreen().addTo(map);

      legend.onAdd = function (map) {
        console.log(map)
        var div = L.DomUtil.create('div', 'info legend')
        var div_html = "";
        div_html += "<div id='legend' class='leaflet-control-layers leaflet-control leaflet-control-legend leaflet-control-layers-expanded'><div class='leaflet-control-layers-base'></div><div class='leaflet-control-layers-separator' style='display: none;'></div><div class='leaflet-control-layers-overlays'><div class='leaflet-control-layers-group' id='leaflet-control-layers-group-2'><span class='leaflet-control-layers-group-name'>Legend</span>";

        var activeLayers = $.each($(".leaflet-control-layers-overlays").find("input:checked"), function(n,item){
          var name = $.trim($(item).parent().text())
          div_html += "<img src='/assets/img/map_legends/"+name+".png' alt='legend for "+name+"'/>"
        })

        div_html += "</div></div></div>"
        div.innerHTML = div_html
        return div;
      };


      map.on('overlayadd', function (eventLayer) {
        handleMapLegend()
      });

      map.on('overlayremove', function (eventLayer) {
        handleMapLegend()
      });

      map.on('moveend', function (eventLayer) {
        var map_center = map.getCenter()
        $("#home-map-aqis-container").html("")
        $.getJSON("/aqs/forecast.json?lat="+map_center.lat+"&lon="+map_center.lng, formatForecastDetails)
      })
      map.fireEvent('moveend')

      map.on('draw:created', compareFeatures)

    }

    // if on an site's page, zoom in close to the site
    if ( $(".dashboard-map").length && feed_location) {
      map.setView(feed_location,9)
    }

    // loop through datasets
    $.each(dataset_keys, function(n,key){
      if($(".filter-"+key+":checked").length > 0){
        $.post("/ckan_proxy/"+key+".geojson", function(data){
          layersData[key] = data
          update_map(key)
        })        
      }
    })

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
      $.getJSON("/"+type+"/"+id+".json", function(data,status){
        if(data.status == "not_found"){
          $(row).find(".sensor-status").html("not_found")
          $(row).addClass("danger")
          $(row).children('td').last().html("No data for this site")
          move_row_to_top(row)
          $(".num-sensors-not_found").html(parseInt($(".num-sensors-not_found").html()) + 1)
        }
        else {
          $(row).find(".sensor-title").html(data.site_name || data.title)
          $(row).find(".sensor-description").html(data.msa_name || data.cmsa_name || data.description)
          var html = formatSensorDetails(data)
          $(row).children('td').last().html(html)
        } 


      })
    })

    $(".momentify").each(function(n,item){
      var original = $(item).html()
      var from_now = moment(original).fromNow()
      $(item).html("<abbr title='"+original+"'>"+from_now+"</abbr>")
    })

    $(".submit-map-filters").on('click',function( event ) {
      event.preventDefault();
      authenticateAndLoadAsthmaHeatLayer($('input.filter-asthmaheat-user').val(),$('input.filter-asthmaheat-pass').val())
      layersData.bike = undefined // BIKE HACK
      $.each(dataset_keys, function(n,key){
        if($(".filter-"+key+":checked").length > 0 || filter_selections[key] == true){
          if(layersData[key] == undefined){
            var post_data = choose_post_data(key)
            $.post("/ckan_proxy/"+key+".geojson", post_data, function(data){
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

    $(".row.aqe .average-Temperature").each(function(n,item){
      var c = $(item).text()
      var f = celsiusToFahrenheit(c)
      var f_rounded = Math.round( f * 10 ) / 10;
      $(item).text(f_rounded)
    })



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

  function onEachFeature(feature, layer) {
    var item = feature.properties
    layer.ref = {type: item.type, id: item.id}
    if(item.type == "aqe"){
      onEachEggFeature(item,layer)
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
      html += "<tr><td>Phone # </td><td>"+item.Phone+" </td></tr>"
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
      if(item.computed_aqi){
        html += "<tr><td>Computed AQI </td><td>"+item.computed_aqi+"</td></tr>"
      }
      html += "<tr><td>Coordinates </td><td>"+item.lat+", "+item.lon+"</td></tr>"
      html += "</table>" 
      html += "</div>"
      layer.bindPopup(html)
    }
    else if(item.type == "parks"){
      layer.setIcon(parkIcon)
      var html = "<div><h4>Park Details</h4>"
      html += "<table class='table table-striped' data-parks_id='"+item.ParkKey+"'>"
      html += "<tr><td>Park Key</td><td>"+item.ParkKey+" </td></tr>"
      html += "<tr><td>Name</td><td><a href='"+item.Url+"' target='blank'>"+item.DisplayName+"</a> </td></tr>"
      html += "<tr><td>Amenities</td><td>"+item.Amenities.join("<br />")+" </td></tr>"
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
      layer.setIcon(foodIcon)
      var html = "<div><h4>Inspected Establishment Details</h4>"
      html += "<table class='table table-striped' data-food_id='"+item.EstablishmentID+"'>"
      html += "<tr><td>Establishment ID</td><td>"+item.EstablishmentID+" </td></tr>"
      html += "<tr><td>Name</td><td>"+item.EstablishmentName+"</a> </td></tr>"
      html += "<tr><td>Inspection Scores</td><td>"+item.Inspections.join("<br />")+" </td></tr>"
      html += "<tr><td>Address</td><td>"+item.Address+" </td></tr>"
      html += "<tr><td>City</td><td>"+item.City+" </td></tr>"
      html += "<tr><td>State</td><td>"+item.State+" </td></tr>"
      html += "<tr><td>Zip</td><td>"+item.Zip+" </td></tr>"
      html += "</table>" 
      html += "</div>"
      layer.bindPopup(html)
    }
    else if(item.type == "famallergy"){
      layer.setIcon(famallergyIcon)
      var html = "<div><h4>Family Allergy & Asthma Observation</h4>"
      html += "<table class='table table-striped' data-famallergy_id='"+item.id+"'>"
      html += "<tr><td>Site Name</td><td>"+item.name+" </td></tr>"
      html += "<tr><td>Site Adddress</td><td>"+item.address+" </td></tr>"
      html += "<tr><td>Site Lat, Lon</td><td>"+item.lat+", "+item.lon+" </td></tr>"
      html += "<tr><td>Latest Pollen Counts</td><td>"+moment(item.datetime+"Z").fromNow()
      html += "<br /><strong>Tree:</strong> "+item.trees
      html += "<br /><strong>Weeds:</strong> "+item.weeds
      html += "<br /><strong>Grass:</strong> "+item.grass
      html += "<br /><strong>Mold:</strong> "+item.mold+" </td></tr>"
      html += "</table>" 
      html += "<p style='font-size:80%'>From <a href='http://www.familyallergy.com/' target='blank'>Family Allergy and Asthma</a> (a group of board-certified allergy and asthma specialists practicing at more than 20 locations throughout Kentucky and Southern Indiana)"
      html += "</div>"
      layer.bindPopup(html)
    }
    else if(item.type == "nursinghome"){
      layer.setIcon(nursinghomeIcon)
      var html = "<div><h4>"+item.provider_name+"</h4>"
      html += "<table class='table table-striped' data-nursinghome_id='"+item.id+"'>"
      html += "<tr><td>Legal Business Name</td><td>"+item.legal_business_name+" </td></tr>"
      html += "<tr><td>Federal Provider #</td><td><a href='http://www.medicare.gov/nursinghomecompare/profile.html#profTab=0&ID="+item.federal_provider_number+"' target='blank'>"+item.federal_provider_number+"</a></td></tr>"
      html += "<tr><td>Provider Address</td><td>"+item.provider_name+" </td></tr>"
      html += "<tr><td>Provider City, State, Zip</td><td>"+item.provider_city+", "+item.provider_state+" "+item.provider_zip_code+" </td></tr>"
      html += "<tr><td>Provider County Name</td><td>"+item.provider_county_name+" </td></tr>"
      html += "<tr><td>Provider Phone</td><td>"+item.provider_phone_number+" </td></tr>"
      html += "<tr><td>Ownership Type</td><td>"+item.ownership_type+" </td></tr>"
      html += "<tr><td>Provider Type</td><td>"+item.provider_type+" </td></tr>"
      html += "<tr><td>Ratings</td><td>"
      html += "<strong>Staffing:</strong> "+item.staffing_rating+"/5"
      html += "<br /><strong>RN Staffing:</strong> "+item.rn_staffing_rating+"/5"
      html += "<br /><strong>Quality Measure:</strong> "+item.qm_rating+"/5"
      html += "<br /><strong>Health Inspection:</strong> "+item.health_inspection_rating+"/5"
      html += "</td></tr>"
      html += "<tr><td>Total Weighted Health Survey Score</td><td>"+item.total_weighted_health_survey_score+" </td></tr>"
      html += "<tr><td>Total # of Penalties</td><td>"+item.total_number_of_penalties+" </td></tr>"
      html += "<tr><td># of Facility Reported Incidents</td><td>"+item.number_of_facility_reported_incidents+" </td></tr>"
      html += "<tr><td># of Certified Beds</td><td>"+item.number_of_certified_beds+" </td></tr>"
      html += "</table>" 
      html += "<p style='font-size:80%'>From <a href='https://data.medicare.gov/data/nursing-home-compare' target='blank'>CMS Nursing Home Compare</a>. This provider was last processed "+moment(item.processing_date).fromNow()+" on "+moment(item.processing_date).calendar()+"."
      html += "</div>"
      layer.bindPopup(html)
    }
    else if(item.type == "wupws"){
      layer.setIcon(weatherStationIcon)
      var html = "<div><h4>"+item.id+"</h4>"
      html += "<table class='table table-striped' data-wupws_id='"+item.id+"'>"
      html += "<tr><td>Neighborhood</td><td>"+item.neighborhood+" </td></tr>"
      html += "<tr><td>City</td><td>"+item.city+" </td></tr>"
      html += "<tr><td>Time Zone</td><td>"+item.tz_short+" </td></tr>"
      html += "<tr><td>Station Equipment</td><td>"+item.station_type+" </td></tr>"
      html += "<tr><td>Lat, Lon</td><td>"+item.lat+", "+item.lon+" </td></tr>"
      html += "</table>" 
      html += "<p style='text-align: right'><a target='blank' href='"+item.wuiurl+"?apiref=8839d23d1235ce5f'>More about this weather station including historical graphs →</a></p>"
      html += "<p style='font-size:80%'>From <a href='http://www.wunderground.com/?apiref=8839d23d1235ce5f' target='blank' title='weather underground'><img src='/assets/img/wunderground.jpg'></a>."
      html += "</div>"
      layer.bindPopup(html)
    } else {
      if(item.type){
        var html = "<div><h4>"+item.type.toUpperCase()+" ID #"+item.id+"</h4></div>"        
        layer.bindPopup(html)
      }      
    }


  }

  function filterFeatures(feature, layer) {
    var item = feature.properties
    var show = true

    if(item.type == "aqe"){
      // AQE indoor/outdoor ===========
      if(filter_selections["outdoor-eggs"] == "true" && item.location_exposure == "outdoor"){ show = true }
      else if(filter_selections["indoor-eggs"] == "true" && item.location_exposure == "indoor"){ show = true }
      else{ show = false }

      // AQE time basis ===============
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

      if(filter_selections["last-datapoint-within-6-hours"] == "true" && filter_selections["last-datapoint-within-24-hours"] == "true" && filter_selections["last-datapoint-within-168-hours"] == "true" && filter_selections["last-datapoint-not-within-168-hours"] == "true"){
        show = true
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
    else if(item.type == "nursinghome"){
      if(filter_selections["nursinghome"] == "true"){ show = true }
      else{ show = false }
    }
    else if(item.type == "wupws"){
      if(filter_selections["wupws"] == "true"){ show = true }
      else{ show = false }
    }
    else if(item.type == "famallergy"){
      if(filter_selections["famallergy"] == "true"){ show = true }
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
    else if(item.type == "bike" && filter_selections["bike-bike_id"] != "" && filter_selections["bike-parameter" != ""]){
      if(filter_selections["bike-bike_id"] == item.bike_id && filter_selections["bike-parameter"] == item.parameter){
        show = true
      }
      else{ show = false }
    }
    else if(item.type == "he2014neighborhoodgeojson"){
      if(filter_selections["he2014neighborhoodgeojson"] == "true"){ show = true}
      else { show = false }
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
    // nursing home specific
    filter_selections["nursinghome"] = $('input.filter-nursinghome:checked').val()
    // weather station (wupws) specific 
    filter_selections["wupws"] = $('input.filter-wupws:checked').val()
    // famallergy specific
    filter_selections["famallergy"] = $('input.filter-famallergy:checked').val()
    // portal.louisvilleky.gov
    filter_selections["food"] = $('input.filter-food:checked').val()
    filter_selections["parks"] = $('input.filter-parks:checked').val()
    // durham labs
    filter_selections["bike-bike_id"] = $('select.filter-bike-bike_id').val()
    filter_selections["bike-parameter"] = $('select.filter-bike-parameter').val()
    if(filter_selections["bike-bike_id"] != "" && filter_selections["bike-parameter"] != ""){
      filter_selections["bike"] = true
    } else {
      filter_selections["bike"] = false
    }
    // health equity report 2014
    filter_selections["he2014neighborhoodgeojson"] = $('input.filter-he2014neighborhoodgeojson').val()
  }

  function update_map(key){
    if(typeof(geoJsonLayers[key]) != "undefined"){map.removeLayer(geoJsonLayers[key]);}    // clear all markers
    update_filters()

    geoJsonLayers[key] = L.geoJson(layersData[key], {
      onEachFeature: onEachFeature,
      filter: filterFeatures
    }).addTo(map);

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

      var recent_history = $.map(data.datastreams,function(data2,name){return {data: data2.recent_history, name: name+" ("+data2.unit+")"} })

      console.log(recent_history)

      $.each(recent_history, function(i,series){
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
          series: recent_history
      });

    })

  }

  function graphAQSHistoricalData(){
    // create skeleton chart

    $.getJSON(location.pathname+".json?include_recent_history=1", function(data){

      var recent_history = $.map(data.datastreams,function(data2,name){return {data: data2.recent_history, name: name+" ("+data2.unit+")"} })

      $.each(recent_history, function(i,series){
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
          series: recent_history
      });

    })

  }

  function handleMapLegend(){
    var controlContainer = $(map._controlContainer)
    // remove legend altogether
    if(controlContainer.find("#legend").length > 0){
      map.removeControl(legend)
    }
    // add legend if it part of a group that has a legend
    if(controlContainer.find("div:contains('Census Data') input:checked").length > 0){
      legend.addTo(map)
    }
  }

  function authenticateAndLoadAsthmaHeatLayer(username,password){
    if(username != "" && password != "" ){
      $.post('/asthmaheat', {username: username, password: password}).done( function(data) {
        var propellerhealth_layer_url = data;
        var propellerhealth_layer_bounds = [[37.8419378866983038, -86.0292621133016979], [38.5821425225734487, -85.1883896469475275]]
        var propellerhealth_layer = L.layerGroup([L.imageOverlay(propellerhealth_layer_url, propellerhealth_layer_bounds, {opacity: 0.8, attribution: "Asthma hotspot heatmap from <a href='http://propellerhealth.com' target=blank>Propeller Health</a>"})])
        map.addLayer(propellerhealth_layer)
      });
    }
  }

  function choose_post_data(key){
    var post_data = {}
    if(key == "bike"){ // BIKE HACK
      post_data['bike_id'] = filter_selections["bike-bike_id"]
      post_data['parameter'] = filter_selections["bike-parameter"]
    }
    return post_data
  }

  function compareFeatures(e){
    if(typeof(drawn) != "undefined"){map.removeLayer(drawn)} // remove previously drawn item
    in_bounds = {} // reset in_bounds away

    var type = e.layerType, layer = e.layer;          
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
    form.target = "_blank"
    var count = 0;
    $.each(in_bounds, function(type,ids){
      var input = document.createElement("input");
      input.name = type;
      input.value = ids.join(",");
      count += ids.length
      form.appendChild(input);
    })
    if(count > 100){form.method = "post"}
    else { form.method = "get" }
    console.log(count,form)
    document.body.appendChild(form);
    form.submit();
    map.addLayer(layer);
  }

})( jQuery );