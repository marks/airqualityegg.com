var map, egg_layer, aqs_layer, school_layer, in_bounds, drawn;
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
  var heatmapIconURL = '/assets/img/heatmap_legend.png'


  var today = new Date()
  var one_day_ago = new Date()
  one_day_ago = one_day_ago.setDate(today.getDate()-1)
  var six_hours_ago = new Date()
  six_hours_ago = six_hours_ago.setHours(today.getHours()-6)

  // Air Quality Egg and AirNow AWS layers
  egg_layer = L.layerGroup([]);
  var egg_layer_inactive_24h = L.layerGroup([]);
  var egg_layer_inactive_6h = L.layerGroup([]);

  // var egg_heatmap = L.heatLayer([], {radius: 35})
  var egg_heatmap = new L.TileLayer.WebGLHeatMap({size: 5000, autoresize: true})
  var egg_heatmap_layer = L.layerGroup([egg_heatmap])

  aqs_layer = L.layerGroup([]);
  school_layer = L.layerGroup([]);

  // Propeller Health image overlay and layer 
  var propellerhealth_layer_url = 'http://s3.amazonaws.com/healthyaws/propeller_health/propeller_health_heatmap_nov13_shared.png';
  var propellerhealth_layer_bounds = [[37.8419378866983038, -86.0292621133016979], [38.5821425225734487, -85.1883896469475275]]
  var propellerhealth_layer = L.layerGroup([L.imageOverlay(propellerhealth_layer_url, propellerhealth_layer_bounds, {opacity: 0.8, attribution: "Asthma hotspot heatmap from <a href='http://propellerhealth.com' target=blank>Propeller Health</a>"})])

  // OpenWeatherMap Layers
  var clouds_layer = L.OWM.clouds({opacity: 0.8, legendImagePath: 'files/NT2.png'});
  var precipitation_layer = L.OWM.precipitation( {opacity: 0.5} );
  var rain_layer = L.OWM.rain({opacity: 0.5});
  var snow_layer = L.OWM.snow({opacity: 0.5});
  var pressure_layer = L.OWM.pressure({opacity: 0.4});
  var temp_layer = L.OWM.temperature({opacity: 0.5});
  var wind_layer = L.OWM.wind({opacity: 0.5});

  var legend = L.control({position: 'bottomright'});
    legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info legend')
    var div_html = "";
    div_html += "<div class='leaflet-control-layers leaflet-control leaflet-control-legend leaflet-control-layers-expanded'><div class='leaflet-control-layers-base'></div><div class='leaflet-control-layers-separator' style='display: none;'></div><div class='leaflet-control-layers-overlays'><div class='leaflet-control-layers-group' id='leaflet-control-layers-group-2'><span class='leaflet-control-layers-group-name'>Legend</span>";
    div_html += "<table>"
    div_html += "<tr><td align='center'><img style='width:19px; height:20px;' src='"+eggIconURL+"' alt='egg'> </td><td> Air Quality Egg</td></tr>";
    div_html += "<tr><td align='center'><img src='"+aqsIconURL+"' alt='blue dot'> </td><td> EPA Air Quality System Site</td></tr>";
    div_html += "<tr><td align='center'><img style='width:19px; height:19px;' src='"+schoolIconURL+"' alt='school'> </td><td> Schools from Dept of Education</td></tr>";
    div_html += "<tr><td align='center'><img style='width:19px; height:19px;' src='"+heatmapIconURL+"' alt='heatmap'> </td><td> Propeller Health Asthma Hotspots</td></tr>";
    div_html += "</table>"
    div_html += "</div></div></div>"
    div.innerHTML = div_html
    return div;
  };


  var groupedOverlays = {
    "Air Quality Eggs": {
      "Markers (updated in past 6 hours)": egg_layer,
      "Markers (last updated 6 to 24 hours ago)": egg_layer_inactive_6h,
      "Markers (last updated > 24 hours ago)": egg_layer_inactive_24h,
      "Heatmap (of all eggs)": egg_heatmap_layer
    },
    "AirNow AQS Sites": {
      "Markers": aqs_layer,
    },
    "Additional Data":{
      "Louisville Asthma Hotspots": propellerhealth_layer,
      "Jefferson County Schools": school_layer
    },
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
    if(typeof(local_feed_path) != "undefined"){
      // set up leaflet map
      map = L.map('map_canvas', {scrollWheelZoom: false, layers: [egg_layer, aqs_layer, propellerhealth_layer]})
      handleNoGeolocation();
      var hash = new L.Hash(map);
    
      var drawControl = new L.Control.Draw({ draw: { polyline: false, marker: false }});
      map.addControl(drawControl);

      L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
          maxZoom: 18
      }).addTo(map);
      L.control.groupedLayers([], groupedOverlays).addTo(map);
      L.control.locate({locateOptions: {maxZoom: 9}}).addTo(map);
      legend.addTo(map)

      // if on an egg's page, zoom in close to the egg
      if ( $(".dashboard-map").length && feed_location) {
        map.setView(feed_location,9)
      }

      $.getJSON(local_feed_path, function(mapmarkers){

        // add eggs to map
        for ( var x = 0, len = mapmarkers.length; x < len; x++ ) {
          addEggMapMarker(mapmarkers[x]);
        }

        $("span#num_eggs").html(mapmarkers.length)
      })

      map.on('overlayadd', function (eventLayer) {
        if(eventLayer.name == "Heatmap (of all eggs)" && eventLayer.group.name == "Air Quality Eggs"){
          var active_eggs = egg_layer.getLayers().map(function(l){return [l.getLatLng().lat, l.getLatLng().lng, 5]})
          var inactive_eggs_24h = egg_layer_inactive_24h.getLayers().map(function(l){return [l.getLatLng().lat, l.getLatLng().lng, 1]})
          var inactive_eggs_6h = egg_layer_inactive_6h.getLayers().map(function(l){return [l.getLatLng().lat, l.getLatLng().lng, 1]})
          egg_heatmap.setData(Array().concat(active_eggs,inactive_eggs_24h,inactive_eggs_6h))
        }
      })

      map.on('draw:created', function (e) {
          if(typeof(drawn) != "undefined"){map.removeLayer(drawn)} // remove previously drawn item
          in_bounds = {} // reset in_bounds away

          var type = e.layerType,
              layer = e.layer;          
          drawn = layer

          var sensor_layers = egg_layer.getLayers().concat(aqs_layer.getLayers())
          $.each(sensor_layers, function(n,item){
            var layer_in_bounds = drawn.getBounds().contains(item.getLatLng())
            if(layer_in_bounds){ 
              if(typeof(in_bounds[item.ref.type]) == "undefined"){ in_bounds[item.ref.type] = [] }
              in_bounds[item.ref.type].push(item.ref.id)
            }
          })

          // open url in new window if there is anything to compare
          var in_bounds_compare_url = "/compare?"
          $.each(in_bounds, function(type,ids){
            in_bounds_compare_url += "&"+type+"="+ids.join(",")
          })
          if(in_bounds_compare_url != "/compare?"){
            window.open(location.origin+in_bounds_compare_url)
          } else {
            alert("Draw a shape over some markers to compare them side-by-side in a new window.")
          }

          map.addLayer(layer);
      });

      //  - load active AQS stations to map
      $.getJSON("/all_aqs_sites.json", function(aqs_mapmarkers){
        for ( var x = 0, len = aqs_mapmarkers.length; x < len; x++ ) {
          addAQSSiteMapMarker( aqs_mapmarkers[x] );
        }
      })

      $.getJSON("http://opendata.socrata.com/resource/w376-xd3c.json", function(school_mapmarkers){
        for ( var x = 0, len = school_mapmarkers.length; x < len; x++ ) {
          addSchoolSiteMapMarker( school_mapmarkers[x] );
        }
      })
    }

    // if on egg dashboard
    if($("#dashboard-egg-chart").length){
      addAQIGauges()
      graphEggHistoricalData();
    }

    // if on AQS dashboard
    if($("#dashboard-aqs-chart").length){
      addAQIGauges()
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

  function handleNoGeolocation() {
    map.setView([38.22847167526397, -85.76099395751953], 11);
  }

  function addEggMapMarker(egg) {
    var marker = L.marker([egg.location_lat, egg.location_lon],  {icon: eggIcon})
    var html = "<div><h4>Air Quality Egg Details</h4><table class='table table-striped' data-feed_id='"+egg.id+"'>"
    html += "<tr><td>Name </td><td> <a href='/egg/"+egg.id+"'><strong>"+egg.title+"<strong></a></td></tr>"
    html += "<tr><td>Description </td><td> "+egg.description+"</td></tr>"
    html += "<tr><td>Position </td><td> "+egg.location_exposure+" @ "+egg.location_ele+" elevation</td></tr>"
    html += "<tr><td>Status </td><td> "+egg.status+"</td></tr>"
    // html += "<tr><td>Last Updated </td><td> "+moment(egg.updated).fromNow()+"</td></tr>"
    html += "<tr><td>Created </td><td> "+moment(egg.created+"Z").fromNow()+"</td></tr>"
    if(egg.last_datapoint){html += "<tr><td>Last data point </td><td> "+moment(egg.last_datapoint+"Z").fromNow()+" ("+egg.last_datapoint+")</td></tr>"}
    html += "</table>"
    html += "<div id='egg_"+egg.id+"'></div>"
    html += "<p style='text-align: right'><a href='/egg/"+egg.id+"'>More about this egg site including historical graphs →</a></p>"
    html += "</div>"
    marker.bindPopup(html)
    marker.ref = {type: "aqe", id: egg.id}
    marker.on('click', onEggMapMarkerClick); 
    var last_datapoint = new Date(egg.last_datapoint+"Z") 
    if(last_datapoint >= six_hours_ago){
      marker.addTo(egg_layer);
    }
    else if(last_datapoint <= six_hours_ago && last_datapoint >= one_day_ago){
      marker.addTo(egg_layer_inactive_6h);
    }
    else {
      marker.addTo(egg_layer_inactive_24h);
    }
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

  function addAQSSiteMapMarker(aqs) {
    var marker = L.marker([aqs.lat, aqs.lon],  {icon: aqsIcon})
    var html = "<div><h4>AirNow AQS Site Details</h4><table class='table table-striped' data-aqs_id='"+aqs.aqs_id+"'>"
    html += "<tr><td>Site</td><td> <a href='/aqs/"+aqs.aqs_id+"'><strong>"+aqs.site_name+" / "+aqs.aqs_id+"</strong></a></td></tr>"
    html += "<tr><td>Agency</td><td>"+aqs.agency_name+"</td></tr>"
    html += "<tr><td>Position</td><td> "+aqs.elevation+" elevation</td></tr>"
    if(aqs.msa_name){html += "<tr><td>MSA</td><td> "+aqs.msa_name+"</td></tr>"}
    if(aqs.cmsa_name){html += "<tr><td>CMSA</td><td> "+aqs.cmsa_name+"</td></tr>"}
    html += "<tr><td>County</td><td>"+aqs.county_name+"</td></tr>"
    html += "<tr><td>Status</td><td>"+aqs.status+"</td></tr>"
    html += "</table>"
    html += "<div id='aqs_"+aqs.aqs_id+"'></div>"
    html += "<p style='text-align: right'><a href='/aqs/"+aqs.aqs_id+"'>More about this AQS site including historical graphs →</a></p>"
    html += "</div>"
    marker.bindPopup(html)
    marker.ref = {type: "aqs", id: aqs.aqs_id}
    marker.on('click', onAQSSiteMapMarkerClick); 
    marker.addTo(aqs_layer);
  }

  function onAQSSiteMapMarkerClick(e){
    var aqs_id = $(".leaflet-popup-content .table").first().data("aqs_id")
    if(typeof(ga)!="undefined"){ ga('send', 'event', 'aqs_'+aqs_id, 'click', 'aqs_on_map', 1); }
    
    $.getJSON("/aqs/"+aqs_id+".json", function(data){
      var html = formatSensorDetails(data)
      $("#aqs_"+aqs_id).append(html)
    })
  }

  function addSchoolSiteMapMarker(school) {
    var marker = L.marker([school.geocoded_location.latitude, school.geocoded_location.longitude],  {icon: schoolIcon})
    var html = "<div><h4>School Details</h4>"
    html += "<table class='table table-striped' data-school_id='"+school.nces_school_id+"'>"
    html += "<tr><td>School Name </td><td>"+school.school_name+" </td></tr>"
    html += "<tr><td>Grades </td><td>"+school.low_grade+" through "+school.high_grade+" </td></tr>"
    html += "<tr><td>Phone Number </td><td>"+school.phone+" </td></tr>"
    html += "<tr><td># Students </td><td>"+school.students+" </td></tr>"
    html += "<tr><td>Student-Teacher Ratio </td><td>"+school.student_teacher_ratio+" </td></tr>"
    html += "<tr><td>Title I School (Wide)? </td><td>"+school.title_i_school+" ("+school.title_1_school_wide+") </td></tr>"
    html += "<tr><td>Magnet School? </td><td>"+school.magnet+" </td></tr>"
    html += "<tr><td>School District </td><td>"+school.district+" </td></tr>"
    html += "<tr><td>NCES School ID </td><td>"+school.nces_school_id+" </td></tr>"
    html += "<tr><td>State School ID </td><td>"+school.state_school_id+" </td></tr>"
    html += "</table>" // <hr />"
    html += "<p style='font-size:80%'>From CCD public school data 2011-2012, 2011-2012 school years. To download full CCD datasets, please go to <a href='http://nces.ed.gov/ccd' target='blank'>the CCD home page</a>."
    html += "</div>"
    marker.bindPopup(html)
    marker.addTo(school_layer);
  }


  //
  // LOCATION PICKER
  //

  // var locpic = new GMapsLatLonPicker(),
  //     locpicker = $(".gllpLatlonPicker").first(),
  //     locsearch = $(".gllpSearchField").first(),
  //     locsaved = parseInt($(".location-saved").first().val()),
  //     geolocate = function () {
  //       navigator.geolocation.getCurrentPosition(function(position) {
  //         $(".gllpLatitude").val(position.coords.latitude);
  //         $(".gllpLongitude").val(position.coords.longitude);
  //         $(".gllpZoom").val(13);
  //         locpic.custom_redraw();
  //       });
  //     };

  // if ( locpicker.length ) {

  //   locpic.init( locpicker );

  //   // search
  //   $(".gllpSearchField").keydown(function(event){
  //     if(event.keyCode == 13){
  //       locpic.performSearch( $(this).val(), false );
  //       event.preventDefault();
  //     }
  //   });

  //   // HTML5 geolocation
  //   if(!locsaved && navigator.geolocation) {
  //     geolocate();
  //   }
  //   if (navigator.geolocation) {
  //     $(".find-me").removeClass("hidden").on("click", function(event) {
  //       event.preventDefault();
  //       geolocate();
  //     });
  //   }

  // }

  //
  // CLAIMING FIELD
  //

  // $(".claiming-form").on( "submit" , function (event) {
  //   var $this   = $(this),
  //       $input  = $this.find(".claiming-input"),
  //       $error  = $(".claiming-error");

  //   if ( $input.val() === "" ) {
  //     event.preventDefault();
  //     $error.html("Please enter a serial number").removeClass("hidden");
  //   }
  //   else {
  //     $(".claiming-button").val("Adding ...").addClass("button-green button-loading");
  //   }
  // });

  // $(".claiming-input").blur( function (event) {
  //   $(".claiming-error").addClass("hidden");
  // });

  //
  // FORM VALIDATION
  //

  // $('.form-validation').on( "submit" , function (event) {
  //   var $this       = $(this),
  //       $required   = $this.find(".field-required [data-validate]"),
  //       $submit     = $this.find('.button[type="submit"]'),
  //       error       = false;

  //   if ( $required.length ) {
  //     var errorify = function ( $bro, msg ) {
  //           var $other = $bro.siblings(".bubble-error");

  //           if ( $bro.val() === "" ) {
  //             error = true;

  //             if ( !$other.length ) {
  //               $("<span></span>", { "class" : "bubble bubble-error", html : msg }).hide().insertAfter( $bro ).slideDown(150);
  //             }
  //             else if ( $other.html() === msg ) {
  //               $other.slideDown(150);
  //             }
  //           }
  //           else {
  //             if ( $other.length || $other.html() === msg ) {
  //               $other.slideUp(150);
  //             }
  //           }
  //         };

  //     $required.each( function () {
  //       var $el   = $(this);

  //       if ( $el.get(0).tagName.toLowerCase() === "input" ) {
  //         errorify( $el, "This field cannot be blank" );
  //       }
  //       else if ( $el.get(0).tagName.toLowerCase() === "select" ) {
  //         errorify( $el, "Please select one of the options" );
  //       }
  //     });
  //   }

  //   if ( error ) {
  //     event.preventDefault();
  //     $(".bubble-error").first().prev().focus();
  //   }
  //   else {
  //     // success
  //     $submit.val("Saving ...").addClass("button-green button-loading");
  //   }
  // });

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

  function addAQIGauges(){
    $(".current-value-gauge").each(function(n,span){
      var value = $(span).data("aqi-value")
      var gauge_id = $(span).attr("id")
      if(value > 0){
        $('#'+gauge_id).highcharts({
                chart: {
                    type: 'gauge',
                    plotBorderWidth: 0,
                    plotShadow: false,
                    backgroundColor:'rgba(255, 255, 255, 0.002)',
                    marginLeft:-55
                },
                credits: { enabled: false },
                exporting: { enabled: false },
                title: { text: ''},
                subtitle: { text: 'AQI:', align: 'left', floating: true, x:-10, y:5},
                pane: {
                    startAngle: -90,
                    endAngle: 90,
                    background: null
                },
                plotOptions: {
                    gauge: {
                        dataLabels: { enabled: false },
                        dial: { radius: '80%' }
                    }
                },
                yAxis: {
                    min: 0,
                    max: 500,
                    minorTickInterval: 'auto',
                    minorTickWidth: 0,
                    minorTickLength: 10,
                    minorTickPosition: 'inside',
                    minorTickColor: '#666',

                    tickPixelInterval: 30,
                    tickWidth: 2,
                    tickPosition: 'inside',
                    tickLength: 10,
                    tickColor: '#666',
                    labels: {
                        step: 5,
                        rotation: 'auto'
                    },
                    title: { text: '' },
                    plotBands: [{
                        from: 0,
                        to: 50,
                        color: '#00E000'
                    }, {
                        from: 51,
                        to: 100,
                        color: '#FFFF00'
                    }, {
                        from: 101,
                        to: 150,
                        color: '#FF7E00'
                    }, {
                        from: 151,
                        to: 200,
                        color: '#FF0000'
                    }, {
                        from: 201,
                        to: 300,
                        color: '#99004C'
                    }, {
                        from: 301,
                        to: 500,
                        color: '#4C0026'
                    }]
                },
                tooltip: {
                  formatter: function(){
                    return 'AQI = '+this.point.y;
                  }
                },

                series: [{
                    name: 'AQI',
                    data: [{y: value}],
                }]

            },
            function () {}
        );

      }
    })
  }


  function celsiusToFahrenheit(value){
    return parseFloat(value) * 9 / 5 + 32
  }

  function aqiToColor(aqi){
    // var aqi = (range[0]+range[1])/2.00
    var color;
    if (aqi <= 50) { color = "#00E400" }
    else if(aqi > 51 && aqi <= 100) { color = "#FFFF00"}
    else if(aqi > 101 && aqi <= 150) { color = "#FF7E00"}
    else if(aqi > 151 && aqi <= 200) { color = "#FF0000"}
    else if(aqi > 201 && aqi <= 300) { color = "#99004C"}
    else if(aqi > 301 && aqi <= 500) { color = "#4C0026"}
    else { color = "#000"}
    return color;
  }


})( jQuery );
